// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import { IObservableString } from './observablestring';

import Automerge, { Text } from 'automerge';

type String = {
  value: Text;
};

/**
 * A concrete implementation of [[IObservableString]]
 */
export class AutomergeString implements IObservableString {
  /**
   * Construct a new observable string.
   */
  constructor(ws: WebSocket, initialText: string = '') {
    this._ws = ws;
    this._text = Automerge.init<string>();
    this._ws.onmessage = (message: MessageEvent) => {
      if (message.data) {
        const change = new Uint8Array(message.data);
        this._text = Automerge.applyChanges(this._text, [change]);
        const text = this._text.value.toString();
        console.log('--- AMS onmessage text', text);
        this._changed.emit({
          type: 'set',
          start: 0,
          end: text.length,
          value: text
        });
      }
    };
  }

  /**
   * The type of the Observable.
   */
  get type(): 'String' {
    return 'String';
  }

  /**
   * A signal emitted when the string has changed.
   */
  get changed(): ISignal<this, IObservableString.IChangedArgs> {
    return this._changed;
  }

  /**
   * Set the value of the string.
   */
  set text(value: string) {
    console.log('--- AMS set text', value);
    if (this._ws.readyState !== this._ws.OPEN) {
      return;
    }
    if (
      this._text.value &&
      value.length === this._text.value.toString().length &&
      value === this._text.value.toString()
    ) {
      return;
    }
    const newText = Automerge.change(this._text, text => {
      text.value = new Text(value);
    });
    const changes = Automerge.getChanges(this._text, newText);
    this._ws.send(changes[0] as any);
    this._text = newText;
    this._changed.emit({
      type: 'set',
      start: 0,
      end: value.length,
      value: value
    });
  }

  /**
   * Get the value of the string.
   */
  get text(): string {
    if (this._text.value) {
      return this._text.value.toString();
    }
    return '';
  }

  /**
   * Insert a substring.
   *
   * @param index - The starting index.
   *
   * @param text - The substring to insert.
   */
  insert(index: number, text: string): void {
    console.log('--- AMS insert', this._text.value.toString());
    const newText = Automerge.change(this._text, doc => {
      doc.value.insertAt!(index, ...text);
    });
    const changes = Automerge.getChanges(this._text, newText);
    this._ws.send(changes[0] as any);
    this._text = newText;
    this._changed.emit({
      type: 'insert',
      start: index,
      end: index + text.length,
      value: text
    });
  }

  /**
   * Remove a substring.
   *
   * @param start - The starting index.
   *
   * @param end - The ending index.
   */
  remove(start: number, end: number): void {
    console.log('--- AMS remove', this._text.value.toString());
    const oldValue: string = this._text.value.toString().slice(start, end);
    const newText = Automerge.change(this._text, doc => {
      doc.value.deleteAt!(start, end - start);
    });
    const changes = Automerge.getChanges(this._text, newText);
    this._ws.send(changes[0] as any);
    this._text = newText;
    this._changed.emit({
      type: 'remove',
      start: start,
      end: end,
      value: oldValue
    });
  }

  /**
   * Set the ObservableString to an empty string.
   */
  clear(): void {
    this._text = Automerge.init<string>();
    this.text = '';
  }

  /**
   * Test whether the string has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources held by the string.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    this.clear();
  }

  private _ws: WebSocket;
  private _text: string;
  private _isDisposed: boolean = false;
  private _changed = new Signal<this, IObservableString.IChangedArgs>(this);
}
