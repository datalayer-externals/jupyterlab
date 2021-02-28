// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import Automerge, { Text } from 'automerge';

import {
  getNested,
  setNested,
  waitDocumentInit,
  AutomergeModelDB,
  Document
} from './ammodeldb';

import { IObservableString } from '../observablestring';

/**
 * A automerge implementation of [[IObservableString]]
 */
export class AutomergeString implements IObservableString {
  /**
   * Construct a new automerge string.
   */
  constructor(path: string[], modelDB: AutomergeModelDB) {
    this._path = path;
    this._modelDB = modelDB;
  }

  public initObservables() {
    const value = getNested(this._modelDB.document, this._path);
    if (value) {
      const s = value.toString()
      this._changed.emit({
        type: 'set',
        start: 0,
        end: s.length,
        value: s
      });
    } else {
      this._modelDB.document = Automerge.change(
        this._modelDB.document,
        `string init`,
        doc => {
          setNested(doc, this._path, new Text());
        }
      );
    }
    // Observe and Handle Remote Changes.
    this._modelDB.observable.observe(
      getNested(this._modelDB.document, this._path),
      (diff, before, after, local, changes, path) => {
        if (!local && diff.edits && diff.props) {
          const edits = diff.edits;
          const props = diff.props;
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
                  value: value,
                  after: after.toString()
                });
              }
            }
            if (edit.action === 'remove') {
              // TODO(ECH) Revisit this...
              if (!value) value = ' ';
              this._changed.emit({
                type: 'remove',
                start: edit.index,
                end: edit.index + value.length,
                value: value,
                after: after.toString()
              });
            }
          }
        }
      }
    );
  }

  set path(path: string[]) {
    this._path = path;
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
    waitDocumentInit(this._modelDB, () => {
      // TODO(ECH) Check this condition
      if (getNested(this._modelDB.document, this._path)) {
        return;
      }
      if (getNested(this._modelDB.document, this._path)) {
        if (
          value.length === getNested(this._modelDB.document, this._path).length &&
          value === getNested(this._modelDB.document, this._path)
        ) {
          return;
        }
      }
      this._modelDB.withLock(() => {
        this._modelDB.document = Automerge.change(
          this._modelDB.document,
          `string set ${this._path} ${value}`,
          doc => {
            doc.set(this._path, new Text(value));
          }
        );
        this._changed.emit({
          type: 'set',
          start: 0,
          end: value.length,
          value: value
        });
      });
    });
  }

  /**
   * Get the value of the string.
   */
  get text(): string {
    return getNested(this._modelDB.document, this._path)
      ? (getNested(this._modelDB.document, this._path) as Text).toString()
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
    waitDocumentInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        this._modelDB.document = Automerge.change(
          this._modelDB.document,
          `string insert ${this._path} ${index} ${text}`,
          doc => {
            (getNested(doc, this._path) as Text).insertAt!(index, ...text);
          }
        );
        this._changed.emit({
          type: 'insert',
          start: index,
          end: index + text.length,
          value: text
        });
      });
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
    waitDocumentInit(this._modelDB, () => {
      const oldValue = getNested(this._modelDB.document, this._path)
        .toString()
        .slice(start, end);
      this._modelDB.withLock(() => {
        this._modelDB.document = Automerge.change(
          this._modelDB.document,
          `string remove ${this._path} ${start} ${end}`,
          doc => {
            (getNested(doc, this._path) as Text).deleteAt!(
              start,
              end - start
            );
          }
        );
        this._changed.emit({
          type: 'remove',
          start: start,
          end: end,
          value: oldValue
        });
      });
    });
  }

  /**
   * Set the ObservableString to an empty string.
   */
  clear(): void {
    waitDocumentInit(this._modelDB, () => {
      this._modelDB.document = Automerge.init<Document>();
      this.text = '';
    });
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

  private _path: string[];
  private _modelDB: AutomergeModelDB;
  private _isDisposed: boolean = false;
  private _changed = new Signal<this, IObservableString.IChangedArgs>(this);
}
