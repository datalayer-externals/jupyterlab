// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import { IObservableString } from './observablestring';

import Automerge, { Text } from 'automerge'

type String = {
  t: Text
}

/**
 * A concrete implementation of [[IObservableString]]
 */
export class AutomergeString implements IObservableString {
  private ws: WebSocket;
  /**
   * Construct a new observable string.
   */
  constructor(initialText: string = '') {
    const uri = encodeURI(`ws://localhost:4321/jlab`);
    console.log('/////', initialText)
    this.ws = new WebSocket(uri);
    this._text = Automerge.init<String>();
    this._text = Automerge.change(this._text, d => {
      d.t = new Text()
    })
    this.ws.onmessage = (message: MessageEvent) => {
      if (message.data) {
        const data = JSON.parse(message.data);
        this._text = Automerge.applyChanges(this._text, data.changes);
        console.log('---', data.changes);
        console.log('---', this._text.t.toString());
        this.text = this._text.t.toString();
        this._changed.emit({
          type: 'set',
          start: 0,
          end: this._text.t.toString().length,
          value: this._text.t.toString()
        });
      }
    }
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
    return this._text.t.toString();
  }

  /**
   * Insert a substring.
   *
   * @param index - The starting index.
   *
   * @param text - The substring to insert.
   */
  insert(index: number, text: string): void {
    this._text = Automerge.change(this._text, doc => {
      doc.t.insertAt!(index, ...text)
    });
    console.log(this._text);
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
    const oldValue: string = this._text.t.toString().slice(start, end);
    this._text = Automerge.change(this._text, doc => {
      doc.t.deleteAt!(start, (end-start))
    });
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

  private _text: String;
  private _isDisposed: boolean = false;
  private _changed = new Signal<this, IObservableString.IChangedArgs>(this);
}
