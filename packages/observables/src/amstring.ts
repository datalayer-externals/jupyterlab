// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import { IObservableString } from './observablestring';

import Automerge, { Observable, Text } from 'automerge';

import { waitForModelInit, AutomergeModelDB, AmDoc } from './ammodeldb';

/**
 * A concrete implementation of [[IObservableString]]
 */
export class AutomergeString implements IObservableString {
  /**
   * Construct a new observable string.
   */
  constructor(
    path: string,
    modelDB: AutomergeModelDB,
    observable: Observable,
    lock: any
  ) {
    this._path = path;
    this._modelDB = modelDB;
    this._observable = observable;
    this._lock = lock;

    // TODO(ECH) Do we need this?
    // this._modelDB.amDoc[this._path] = new Text();
  }

  public observeRemotes() {
    // Observe and Handle Remote Changes.
    this._observable.observe(
      this._modelDB.amDoc,
      (diff, before, after, local) => {
        if (!local && diff.props && diff.props[this._path]) {
          const opId = Object.keys(diff.props[this._path] as any)[0];
          const ad = diff.props[this._path][opId] as Automerge.ObjectDiff;
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
      }
    );
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
    waitForModelInit(this._modelDB, () => {
      if (this._modelDB.amDoc[this._path]) {
        return;
      }
      if (this._modelDB.amDoc[this._path]) {
        if (
          value.length === this._modelDB.amDoc[this._path].length &&
          value === this._modelDB.amDoc[this._path]
        ) {
          return;
        }
      }
      // TODO(ECH) Check this condition !this...
      if (this._modelDB.isInitialized) {
        this._lock(() => {
          this._modelDB.amDoc = Automerge.change(
            this._modelDB.amDoc,
            `string set ${this._path} ${value}`,
            doc => {
              doc[this._path] = new Text(value);
            }
          );
        });
      };
      this._changed.emit({
        type: 'set',
        start: 0,
        end: value.length,
        value: value
      });
    });
  }

  /**
   * Get the value of the string.
   */
  get text(): string {
    return this._modelDB.amDoc[this._path]
      ? (this._modelDB.amDoc[this._path] as Text).toString()
      : '';
  }

  /**
   * Insert a substring.
   *
   * @param index - The starting index.
   *
   * @param text - The substring to insert.
   */
  insert(index: number, text: string): void {
    if (this._modelDB.isInitialized) {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `string insert ${this._path} ${index} ${text}`,
          doc => {
            (doc[this._path] as Text).insertAt!(index, ...text);
          }
        );
      });
    }
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
    const oldValue = this._modelDB.amDoc[this._path]
      .toString()
      .slice(start, end);
    if (this._modelDB.isInitialized) {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `string remove ${this._path} ${start} ${end}`,
          doc => {
            (doc[this._path] as Text).deleteAt!(start, end - start);
          }
        );
      });
    }
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
    this._modelDB.amDoc = Automerge.init<AmDoc>();
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

  private _path: string;
  private _modelDB: AutomergeModelDB;
  private _observable: Observable;
  private _lock: any;
  private _isDisposed: boolean = false;
  private _changed = new Signal<this, IObservableString.IChangedArgs>(this);
}
