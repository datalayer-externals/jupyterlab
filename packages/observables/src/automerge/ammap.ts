// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import Automerge from 'automerge';

import {
  getNested, 
  setNested, 
  waitDocumentInit, 
  AutomergeModelDB
} from './ammodeldb';

import { IObservableMap } from '../observablemap';

/**
 * A automerge implementation of IObservableMap<T>.
 */
export class AutomergeMap<T> implements IObservableMap<T> {
  /**
   * Construct a new automerge map.
   */
  constructor(
    path: string[],
    modelDB: AutomergeModelDB,
    options: AutomergeMap.IOptions<T> = {}
  ) {
    this._path = path;
    this._modelDB = modelDB;
    this._itemCmp = options.itemCmp || Private.itemCmp;
  }

  public initObservables() {
    if (!getNested(this._modelDB.document, this._path)) {
      this._modelDB.document = Automerge.change(
        this._modelDB.document,
        `map init`,
        doc => {
          setNested(doc, this._path, {});
        }
      );
    }
    // Observe and Handle Changes.
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
              type: oldVal ? 'change' : 'add',  
              key: key,
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
    return getNested(this._modelDB.document, this._path)
      ? getNested(this._modelDB.document, this._path).size
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
    const oldVal = getNested(this._modelDB.document, this._path)
      ? getNested(this._modelDB.document, this._path)[key]
      : undefined;
    waitDocumentInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        // Bail if the value does not change.
        const itemCmp = this._itemCmp;
        if (oldVal !== undefined && itemCmp(oldVal, value)) {
          return oldVal;
        }
        this._modelDB.document = Automerge.change(
          this._modelDB.document,
          `map set ${this._path} ${key} ${value}`,
          doc => {
            setNested(doc, this._path.concat([key]), value);
          }
        );
        this._changed.emit({
          type: oldVal ? 'change' : 'add',
          key: key,
          oldValue: oldVal,
          newValue: value
        });
      });
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
    return getNested(this._modelDB.document, this._path)
      ? getNested(this._modelDB.document, this._path)[key]
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
    return getNested(this._modelDB.document, this._path)
      ? getNested(this._modelDB.document, this._path)[key]
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
    getNested(this._path).forEach((v: T, k: string) => {
      keyList.push(k);
    });
    return keyList;
    */
    return getNested(this._modelDB.document, this._path)
      ? Object.keys(getNested(this._modelDB.document, this._path))
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
    getNested(this._path).forEach((v: T, k: string) => {
      valList.push(v);
    });
    return valList;
    */
    return getNested(this._modelDB.document, this._path)
      ? Object.values(getNested(this._modelDB.document, this._path))
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
    const old = getNested(this._modelDB.document, this._path);
    if (!old) {
      return;
    }
    const oldVal = old[key];
    if (!oldVal) {
      return oldVal;
    }
    // TODO(ECH) Fix this. We need to remove the key...
    waitDocumentInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        this._modelDB.document = Automerge.change(
          this._modelDB.document,
          `map delete ${this._path} ${key}`,
          doc => {
            const path = this._path.concat([key]);
            setNested(doc, path, '');
          }
        );
      });
      const removed = true;
      if (removed) {
        this._changed.emit({
          type: 'remove',
          key: key,
          oldValue: oldVal,
          newValue: undefined
        });
      }
    });
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
    if (getNested(this._modelDB.document, this._path)) {
      getNested(this._modelDB.document, this._path).clear();
    }
  }

  protected _path: string[];
  protected _modelDB: AutomergeModelDB;
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
