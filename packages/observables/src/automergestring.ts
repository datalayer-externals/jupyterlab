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
  constructor(actorId: string, amModelDB: AMModelDB, observable: Observable) {
    //    this._actorId = actorId;
    this._amModelDB = amModelDB;
    this._observable = observable;

    // Observe and Handle Remote Changes.
    this._observable.observe(this._amModelDB, (diff, before, after, local) => {
      this._amModelDB = after;
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
    // TODO(ECH) Review this...
    // Bail for now.
  }

  /**
   * Get the value of the string.
   */
  get text(): string {
    return this._amModelDB.text ? this._amModelDB.text.toString() : '';
  }

  /**
   * Insert a substring.
   *
   * @param index - The starting index.
   *
   * @param text - The substring to insert.
   */
  insert(index: number, text: string): void {
    this._amModelDB = Automerge.change(this._amModelDB, doc => {
      doc.text.insertAt!(index, ...text);
    });
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
    const oldValue = this._amModelDB.text.toString().slice(start, end);
    this._amModelDB = Automerge.change(this._amModelDB, doc => {
      doc.text.deleteAt!(start, end - start);
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
    this._amModelDB = Automerge.init<AMModelDB>();
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

  //  private _actorId: string;
  private _amModelDB: AMModelDB;
  private _observable: Observable;
  private _isDisposed: boolean = false;
  private _changed = new Signal<this, IObservableString.IChangedArgs>(this);
}
