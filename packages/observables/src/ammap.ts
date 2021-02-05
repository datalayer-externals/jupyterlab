// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import Automerge, { Observable } from 'automerge';

import { IObservableMap } from './observablemap';

import { AutomergeModelDB } from './ammodeldb';

/**
 * A concrete implementation of IObservbleMap<T>.
 */
export class AutomergeMap<T> implements IObservableMap<T> {
  /**
   * Construct a new observable map.
   */
  constructor(
    path: string,
    modelDB: AutomergeModelDB,
    observable: Observable,
    lock: any,
    options: AutomergeMap.IOptions<T> = {}
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
        if (!local && diff.props && diff.props && diff.props[this._path]) {
          Object.keys(after[this._path]).map(uuid => {
            if (before[this._path]) {
              const oldVal = before[this._path]
                ? before[this._path][uuid]
                : undefined;
              const newVal = after[this._path]
                ? after[this._path][uuid]
                : undefined;
              this._changed.emit({
                type: oldVal ? 'change' : 'add',
                key: uuid,
                oldValue: oldVal,
                newValue: newVal
              });
            }
          });
        }
      }
    );
  }

  /**
   * The type of the Observable.
   */
  get type(): 'Map' {
    return 'Map';
  }

  /**
   * A signal emitted when the map has changed.
   */
  get changed(): ISignal<this, IObservableMap.IChangedArgs<T>> {
    return this._changed;
  }

  /**
   * Whether this map has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * The number of key-value pairs in the map.
   */
  get size(): number {
    return this._modelDB.amDoc[this._path]
      ? this._modelDB.amDoc[this._path].size
      : 0;
  }

  /**
   * Set a key-value pair in the map
   *
   * @param key - The key to set.
   *
   * @param value - The value for the key.
   *
   * @returns the old value for the key, or undefined
   *   if that did not exist.
   *
   * @throws if the new value is undefined.
   *
   * #### Notes
   * This is a no-op if the value does not change.
   */
  set(key: string, value: T): T | undefined {
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

  /**
   * Get a value for a given key.
   *
   * @param key - the key.
   *
   * @returns the value for that key.
   */
  get(key: string): T | undefined {
    return this._modelDB.amDoc[this._path]
      ? this._modelDB.amDoc[this._path][key]
      : undefined;
  }

  /**
   * Check whether the map has a key.
   *
   * @param key - the key to check.
   *
   * @returns `true` if the map has the key, `false` otherwise.
   */
  has(key: string): boolean {
    return this._modelDB.amDoc[this._path]
      ? this._modelDB.amDoc[this._path][key]
        ? true
        : false
      : false;
  }

  /**
   * Get a list of the keys in the map.
   *
   * @returns - a list of keys.
   */
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

  /**
   * Get a list of the values in the map.
   *
   * @returns - a list of values.
   */
  values(): T[] {
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
  delete(key: string): T | undefined {
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
   * Set the ObservableMap to an empty map.
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
  private _itemCmp: (first: T, second: T) => boolean;
  private _changed = new Signal<this, IObservableMap.IChangedArgs<T>>(this);
  private _isDisposed = false;
}

/**
 * The namespace for `ObservableMap` class statics.
 */
export namespace AutomergeMap {
  /**
   * The options used to initialize an observable map.
   */
  export interface IOptions<T> {
    /**
     * An optional initial set of values.
     */
    values?: { [key: string]: T };

    /**
     * The item comparison function for change detection on `set`.
     *
     * If not given, strict `===` equality will be used.
     */
    itemCmp?: (first: T, second: T) => boolean;
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
