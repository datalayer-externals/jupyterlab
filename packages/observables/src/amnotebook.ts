// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import Automerge, { Observable } from 'automerge';

import { AutomergeModelDB } from './ammodeldb';

import { IObservableNotebook } from './observablenotebook';

export class AutomergeNotebook implements IObservableNotebook {

  constructor(
    path: string,
    modelDB: AutomergeModelDB,
    observable: Observable,
    lock: any,
    options: AutomergeNotebook.IOptions = {}
  ) {
    this._path = path;
    this._modelDB = modelDB;
    this._observable = observable;
    this._lock = lock;

    // TODO(ECH) Do we need this?
//    this._modelDB.amDoc[this._path] = {};

    this._itemCmp = options.itemCmp || Private.itemCmp;

    if (options.values) {
      for (const key in options.values) {
        this._modelDB.amDoc[this._path][key] = options.values[key];
      }
    }
  }

  public observeRemotes() {
    // Observe and Handle Remote Changes.
    this._observable.observe(
      this._modelDB.amDoc,
      (diff, before, after, local) => {
        console.log('---', diff);
      }
    );
  }

  /**
   * The type of the Observable.
   */
  get type(): 'Notebook' {
    return 'Notebook';
  }

  /**
   * A signal emitted when the map has changed.
   */
  get changed(): ISignal<this, IObservableNotebook.IChangedArgs> {
    return this._changed;
  }

  /**
   * Whether this map has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get size(): number {
    return this._modelDB.amDoc[this._path]
      ? this._modelDB.amDoc[this._path].size
      : 0;
  }

  set(key: string, value: any): any | undefined {
    if (value === undefined) {
      throw Error('Cannot set an undefined value, use remove');
    }
    const oldVal = this._modelDB.amDoc[this._path]
      ? this._modelDB.amDoc[this._path][key]
      : undefined;
    // Bail if the value does not change.
    const itemCmp = this._itemCmp;
    if (oldVal !== undefined && itemCmp(oldVal, value)) {
      return oldVal;
    }
    if (!this._modelDB.amDoc[key]) {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `map set ${this._path} ${key}`,
          doc => {
            doc[this._path] = {};
          }
        );
      });
    }
    if (this._modelDB.isInitialized) {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `map set ${this._path} ${key} ${value}`,
          doc => {
            doc[this._path][key] = value;
          }
        );
      });
    }
    this._changed.emit({
      type: oldVal ? 'change' : 'add',
      key: key,
      oldValue: oldVal,
      newValue: value
    });
    return oldVal;
  }

  get(key: string): any | undefined {
    return this._modelDB.amDoc[this._path]
      ? this._modelDB.amDoc[this._path][key]
      : undefined;
  }

  has(key: string): boolean {
    return this._modelDB.amDoc[this._path]
      ? this._modelDB.amDoc[this._path][key]
        ? true
        : false
      : false;
  }

  keys(): string[] {
    /*
    const keyList: string[] = [];
    this._modelDB.amDoc[this._path].forEach((v: T, k: string) => {
      keyList.push(k);
    });
    return keyList;
    */
    return this._modelDB.amDoc[this._path]
      ? Object.keys(this._modelDB.amDoc[this._path])
      : [];
  }

  values(): any[] {
    /*
    const valList: T[] = [];
    this._modelDB.amDoc[this._path].forEach((v: T, k: string) => {
      valList.push(v);
    });
    return valList;
    */
    return this._modelDB.amDoc[this._path]
      ? Object.values(this._modelDB.amDoc[this._path])
      : [];
  }

  /**
   * Remove a key from the map
   *
   * @param key - the key to remove.
   *
   * @returns the value of the given key,
   *   or undefined if that does not exist.
   *
   * #### Notes
   * This is a no-op if the value does not change.
   */
  delete(key: string): any | undefined {
    const old = this._modelDB.amDoc[this._path]
    if (!old) {
      return;
    }
    const oldVal = old[key];
    if (!oldVal) {
      return oldVal;
    }
    if (this._modelDB.isInitialized) {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `map delete ${this._path} ${key}`,
          doc => {
            delete doc[this._path][key];
          }
        );
      });
    }
    const removed = true;
    if (removed) {
      this._changed.emit({
        type: 'remove',
        key: key,
        oldValue: oldVal,
        newValue: undefined
      });
    }
    return oldVal;
  }

  /**
   * Set the ObservableNotebook to an empty map.
   */
  clear(): void {
    // Delete one by one to emit the correct signals.
    const keyList = this.keys();
    for (let i = 0; i < keyList.length; i++) {
      this.delete(keyList[i]);
    }
  }

  /**
   * Dispose of the resources held by the map.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    if (this._modelDB.amDoc[this._path]) {
      this._modelDB.amDoc[this._path].clear();
    }
  }

  private _path: string;
  private _modelDB: AutomergeModelDB;
  private _observable: Observable;
  private _lock: any;
  private _itemCmp: (first: any, second: any) => boolean;
  private _changed = new Signal<this, IObservableNotebook.IChangedArgs>(this);
  private _isDisposed = false;
}

/**
 * The namespace for `ObservableNotebook` class statics.
 */
export namespace AutomergeNotebook {
  /**
   * The options used to initialize an observable map.
   */
  export interface IOptions {
    /**
     * An optional initial set of values.
     */
    values?: { [key: string]: any };

    /**
     * The item comparison function for change detection on `set`.
     *
     * If not given, strict `===` equality will be used.
     */
    itemCmp?: (first: any, second: any) => boolean;
  }
}

/**
 * The namespace for module private data.
 */
namespace Private {
  /**
   * The default strict equality item comparator.
   */
  export function itemCmp(first: any, second: any): boolean {
    return first === second;
  }
}
