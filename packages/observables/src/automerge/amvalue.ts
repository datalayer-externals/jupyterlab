// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import { JSONExt, JSONValue } from '@lumino/coreutils';

import Automerge from 'automerge';

import { IObservableValue } from './../observablevalue';

import { amDocPath, setForcedNested, waitOnAmDocInit, AutomergeModelDB } from './ammodeldb';

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
    path: string[],
    modelDB: AutomergeModelDB,
    initialValue: JSONValue = null
  ) {
    this._path = path;
    this._modelDB = modelDB;
    this._initialValue = initialValue;
  }

  public initObservables() {
    if (!amDocPath(this._modelDB.amDoc, this._path)) {
      this._modelDB.amDoc = Automerge.change(
        this._modelDB.amDoc,
        `value init`,
        doc => {
          setForcedNested(doc, this._path, this._initialValue);
        }
      );
    }
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
    return amDocPath(this._modelDB.amDoc, this._path);
  }

  /**
   * Set the current value.
   */
  set(value: JSONValue): void {
    waitOnAmDocInit(this._modelDB, () => {
      const oldValue = amDocPath(this._modelDB.amDoc, this._path);
      if (JSONExt.deepEqual(oldValue, value)) {
        return;
      }
      this._modelDB.amDoc = Automerge.change(
        this._modelDB.amDoc,
        `value set ${this._path} ${value}`,
        doc => {
          setForcedNested(doc, this._path, value);
        }
      );
      this._changed.emit({
        oldValue: oldValue,
        newValue: value
      });
    });
  }

  /**
   * Dispose of the resources held by the value.
   */
  dispose(): void {
    waitOnAmDocInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        if (this._isDisposed) {
          return;
        }
        this._isDisposed = true;
        Signal.clearData(this);
        this._modelDB.amDoc = Automerge.change(
        this._modelDB.amDoc,
          `value delete ${this._path}`,
          doc => {
            setForcedNested(doc, this._path, undefined);
          }
        );
      });
    });
  }

  private _path: string[];
  private _modelDB: AutomergeModelDB;
  private _initialValue: JSONValue;
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
