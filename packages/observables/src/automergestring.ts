// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import { IObservableString } from './observablestring';

import Automerge, { Observable } from 'automerge';

import { AMModelDB } from './automergemodeldb';

/**
 * A concrete implementation of [[IObservableString]]
 */
export class AutomergeString implements IObservableString {
  /**
   * Construct a new observable string.
   */
  constructor(
    ws: WebSocket,
    actorId: string,
    text: AMModelDB,
    observable: Observable,
    initialText: string = ''
  ) {
    this._ws = ws;
    this._actorId = actorId;
    this._text = text;
    this._observable = observable;

    // Observe and handle remote changes.
    this._observable.observe(this._text, (diff, before, after, local) => {
      if (!local && diff.props && diff.props.text) {
        const opId = Object.keys(diff.props?.text as any)[0];
        const ad = diff.props?.text[opId] as Automerge.ObjectDiff;
        const edits = ad.edits;
        if (edits) {
          const props = ad.props;
          if (props) {
            let propsMap = new Map<any, string>();
            Object.keys(props).map(key => {
              const s = props[key];
              const t = Object.keys(s)[0];
              propsMap.set(t, (s[t] as any).value as string);
            });
            for (let i = 0; i < edits.length; i++) {
              const edit = edits[i];
              let value = propsMap.get(edit.elemId);
              if (edit.action === 'insert') {
                if (value) {
                  this._changed.emit({
                    type: 'insert',
                    start: edit.index,
                    end: edit.index + value.length,
                    value: value
                  });
                }
              }
              if (edit.action === 'remove') {
                if (!value) value = ' ';
                this._changed.emit({
                  type: 'remove',
                  start: edit.index,
                  end: edit.index + value.length,
                  value: value
                });
              }
            }
          }
        }
      }
    });

    // Listen on remote changes.
    this._ws.onmessage = (message: MessageEvent) => {
      if (message.data) {
        const change = new Uint8Array(message.data);
        Automerge.Frontend.setActorId(this._text, this._actorId);
        this._text = Automerge.applyChanges(this._text, [change]);
        if (!this._text.cursors[this._actorId]) {
          const newText = Automerge.change(this._text, s => {
            s.cursors[this._actorId] = s.text.getCursorAt(
              s.text.toString().length - 1
            );
          });
          const changes = Automerge.getChanges(this._text, newText);
          changes.map(change => this._ws.send(change));
          this._text = newText;
        }
        /*
        Object.keys(this._text.cursors).map(userId => {
          console.log(
            '--- Cursor Index',
            userId,
            Automerge.getCursorIndex(
              this._text,
              this._text.cursors[userId],
              true
            )
          );
        });
        */
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
    if (this._ws.readyState !== this._ws.OPEN) {
      return;
    }
    if (
      this._text.text &&
      value.length === this._text.text.toString().length &&
      value === this._text.text.toString()
    ) {
      return;
    }
    /*
    let newText = Automerge.change(this._text, text => {
      text.text = new Text(value);
      //      text.cursors[this._actorId] = text.text.getCursorAt(value.length - 1);
    });
    const changes = Automerge.getChanges(this._text, newText);
    changes.map(change => this._ws.send(change));
    this._text = newText;
    this._changed.emit({
      type: 'set',
      start: 0,
      end: value.length,
      value: value
    });
    */
  }

  /**
   * Get the value of the string.
   */
  get text(): string {
    if (this._text.text) {
      return this._text.text.toString();
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
    const newText = Automerge.change(this._text, doc => {
      doc.text.insertAt!(index, ...text);
    });
    const changes = Automerge.getChanges(this._text, newText);
    changes.map(change => this._ws.send(change));
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
    const oldValue = this._text.text.toString().slice(start, end);
    const newText = Automerge.change(this._text, doc => {
      doc.text.deleteAt!(start, end - start);
    });
    const changes = Automerge.getChanges(this._text, newText);
    changes.map(change => this._ws.send(change));
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
    this._text = Automerge.init<AMModelDB>();
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
  private _actorId: string;
  private _text: AMModelDB;
  private _observable: Observable;
  private _isDisposed: boolean = false;
  private _changed = new Signal<this, IObservableString.IChangedArgs>(this);
}
