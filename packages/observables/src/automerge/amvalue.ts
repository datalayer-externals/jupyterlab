// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import { JSONExt, JSONValue } from '@lumino/coreutils';

import Automerge from 'automerge';

import { getNested, setNested, waitDocumentInit, AutomergeModelDB } from './ammodeldb';

import { IObservableValue, ObservableValue } from './../observablevalue';

/**
 * A automerge implementation of an `IObservableValue`.
 */
export class AutomergeValue implements IObservableValue {
  /**
   * Constructor for the value.
   *
   * @param initialValue: the starting value for the `ObservableValue`.
   */
  constructor(
    path: string[],
    modelDB: AutomergeModelDB,
    initialValue: JSONValue = ''
  ) {
    this._path = path;
    this._modelDB = modelDB;
    this._initialValue = initialValue;
  }

  public initObservables() {
    if (!getNested(this._modelDB.document, this._path)) {
      this._modelDB.document = Automerge.change(
        this._modelDB.document,
        `value init`,
        doc => {
          setNested(doc, this._path, { value: this._initialValue });
        }
      );
    }
    this._modelDB.observable.observe(
      getNested(this._modelDB.document, this._path),
      (diff, before, after, local, changes, path) => {
        this._path = path as string[];
        if (!local) {
          Object.keys(after).map(key => {
            const oldVal = before[key]
              ? before[key]
              : undefined;
            const newVal = after[key]
              ? after[key]
              : undefined;
            this._changed.emit({
              oldValue: oldVal,
              newValue: newVal
            });
          });
        }
      }
    );
  }

  set path(path: string[]) {
    this._path = path;
  }

  /**
   * The observable type.
   */
  get type(): 'Value' {
    return 'Value';
  }

  /**
   * Whether the value has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * The changed signal.
   */
  get changed(): ISignal<this, ObservableValue.IChangedArgs> {
    return this._changed;
  }

  /**
   * Get the current value, or `undefined` if it has not been set.
   */
  get(): JSONValue {
    if (!getNested(this._modelDB.document, this._path)) {
      return '';
    }
    return getNested(this._modelDB.document, this._path).value;
  }

  /**
   * Set the current value.
   */
  set(value: JSONValue): void {
    waitDocumentInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        const oldValue = getNested(this._modelDB.document, this._path).value;
        if (JSONExt.deepEqual(oldValue, value)) {
          return;
        }
        this._modelDB.document = Automerge.change(
          this._modelDB.document,
          `value set ${this._path} ${value}`,
          doc => {
            setNested(doc, this._path, { value: value });
          }
        );
        this._changed.emit({
          oldValue: oldValue,
          newValue: value
        });
      });
    });
  }

  /**
   * Dispose of the resources held by the value.
   */
  dispose(): void {
    waitDocumentInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        if (this._isDisposed) {
          return;
        }
        this._isDisposed = true;
        Signal.clearData(this);
        this._modelDB.document = Automerge.change(
        this._modelDB.document,
          `value delete ${this._path}`,
          doc => {
            setNested(doc, this._path, undefined);
          }
        );
      });
    });
  }

  private _path: string[];
  private _modelDB: AutomergeModelDB;
  private _initialValue: JSONValue;
  private _isDisposed: boolean = false;
  private _changed = new Signal<this, ObservableValue.IChangedArgs>(this);
}
