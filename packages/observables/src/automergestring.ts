// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import { IObservableString } from './observablestring';

import Automerge, { Text } from 'automerge'

type String = {
  value: Text
}

/**
 * A concrete implementation of [[IObservableString]]
 */
export class AutomergeString implements IObservableString {
  /**
   * Construct a new observable string.
   */
  constructor(ws: WebSocket, initialText: string = '') {
    this._ws = ws;
    this._text = Automerge.init<String>()
    this._ws.onmessage = (message: MessageEvent) => {
      if (message.data) {
        console.log('---', message.data);
        const change = new Uint8Array(message.data);
        this._text = Automerge.applyChanges(this._text, [change]);
        console.log('---', this._text.value.toString());
        this.text = this._text.value.toString();
        this._changed.emit({
          type: 'set',
          start: 0,
          end: this._text.value.toString().length,
          value: this._text.value.toString()
        });
      }
    }

    this._text = Automerge.init<String>();
    this._text = Automerge.change(this._text, d => {
      d.value = new Text(initialText)
    })
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

  }

  /**
   * Get the value of the string.
   */
  get text(): string {
    return this._text.value.toString();
  }

  /**
   * Insert a substring.
   *
   * @param index - The starting index.
   *
   * @param text - The substring to insert.
   */
  insert(index: number, text: string): void {
    const newText = Automerge.change(this._text, doc => {
      doc.value.insertAt!(index, ...text)
    });
    const changes = Automerge.getChanges(this._text, newText);
    this._ws.send(changes[0] as any);
    console.log('---', this._text.value.toString());
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
    const oldValue: string = this._text.value.toString().slice(start, end);
    this._text = Automerge.change(this._text, doc => {
      doc.value.deleteAt!(start, (end-start))
    });
    console.log('---', this._text.value.toString());
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
  private _text: String;
  private _isDisposed: boolean = false;
  private _changed = new Signal<this, IObservableString.IChangedArgs>(this);
}
