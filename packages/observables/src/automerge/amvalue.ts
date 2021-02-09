// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import { JSONExt, JSONValue } from '@lumino/coreutils';

import { IObservableValue } from './../observablevalue';

import Automerge, { Observable } from 'automerge';

import { waitForModelInit, AutomergeModelDB } from './ammodeldb';

 /**
 * A concrete implementation of an `IObservableValue`.
 */
export class AutomergeValue implements IObservableValue {
  /**
   * Constructor for the value.
   *
   * @param initialValue: the starting value for the `ObservableValue`.
   */
  constructor(
    path: string,
    modelDB: AutomergeModelDB,
    observable: Observable,
    lock: any,
    initialValue: JSONValue = null
  ) {
    this._path = path;
    this._modelDB = modelDB;
    this._observable = observable;
    this._lock = lock;
    // TODO(ECH) Revisit this...
    if (initialValue || initialValue === '') {
      this.set(initialValue);
    }
  }

  public initObservables() {
    // Observe and Handle Remote Changes.
    this._observable.observe(
      this._modelDB.amDoc,
      (diff, before, after, local) => {
//        console.log('---', diff.props);
      }
    );
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
  get changed(): ISignal<this, AutomergeValue.IChangedArgs> {
    return this._changed;
  }

  /**
   * Get the current value, or `undefined` if it has not been set.
   */
  get(): JSONValue {
    return this._modelDB.amDoc[this._path];
  }

  /**
   * Set the current value.
   */
  set(value: JSONValue): void {
    const oldValue = this._modelDB.amDoc[this._path];
    if (JSONExt.deepEqual(oldValue, value)) {
      return;
    }
    waitForModelInit(this._modelDB, () => {
      this._modelDB.amDoc = Automerge.change(
        this._modelDB.amDoc,
        `value set ${this._path} ${value}`,
        doc => {
          doc[this._path] = value;
        }
      );
    });
    this._changed.emit({
      oldValue: oldValue,
      newValue: value
    });
  }

  /**
   * Dispose of the resources held by the value.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    if (this._modelDB.isInitialized) {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `value delete ${this._path}`,
          doc => {
            delete doc[this._path];
          }
        );
      });
    }
  }

  private _path: string;
  private _modelDB: AutomergeModelDB;
  private _observable: Observable;
  private _lock: any;
  private _isDisposed: boolean = false;
  private _changed = new Signal<this, AutomergeValue.IChangedArgs>(this);
}

/**
 * The namespace for the `ObservableValue` class statics.
 */
export namespace AutomergeValue {
  /**
   * The changed args object emitted by the `IObservableValue`.
   */
  export class IChangedArgs {
    /**
     * The old value.
     */
    oldValue: JSONValue | undefined;

    /**
     * The new value.
     */
    newValue: JSONValue | undefined;
  }
}
