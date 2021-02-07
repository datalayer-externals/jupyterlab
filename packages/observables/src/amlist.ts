// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ArrayExt,
  ArrayIterator,
  IIterator,
  IterableOrArrayLike,
  each,
  toArray
} from '@lumino/algorithm';

import { ISignal, Signal } from '@lumino/signaling';

import Automerge, { Observable, List } from 'automerge';

import { IObservableList } from './observablelist';

import { AutomergeModelDB } from './ammodeldb';

/**
 * A concrete implementation of [[IObservableList]].
 */
export class AutomergeList<T> implements IObservableList<T> {
  /**
   * Construct a new observable map.
   */
  constructor(
    path: string,
    modelDB: AutomergeModelDB,
    observable: Observable,
    lock: any,
    options: AutomergeList.IOptions<T> = {}
  ) {
    this._path = path;
    this._modelDB = modelDB;
    this._observable = observable;
    this._lock = lock;

    this._lock(() => {
      if (options.values !== void 0) {
        each(options.values, value => {
          this._modelDB.amDoc = Automerge.change(
            this._modelDB.amDoc,
            `list init ${this._path} ${value}`,
            doc => {
              doc[this._path] = [];
              (doc[this._path] as List<T>).push(value);
            }
          );
        });
      } else {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list init ${this._path}`,
          doc => {
            doc[this._path] = [];
          }
        );
      }
    });

    this._itemCmp = options.itemCmp || Private.itemCmp;

  }

  public initObservables() {
    // Observe and Handle Remote Changes.
    this._observable.observe(
      this._modelDB.amDoc,
      (diff, before, after, local) => {
        if (!local && diff.props && diff.props && diff.props[this._path]) {
          /*
          console.log('---', diff.props[this._path]);
          Object.keys(after[this._path]).map(uuid => {
            console.log('uuid');
          });
          */
        }
      }
    );
  }

  /**
   * The type of this object.
   */
  get type(): 'List' {
    return 'List';
  }

  /**
   * A signal emitted when the list has changed.
   */
  get changed(): ISignal<this, IObservableList.IChangedArgs<T>> {
    return this._changed;
  }

  /**
   * The length of the list.
   */
  get length(): number {
    return this._modelDB.amDoc[this._path]
      ? (this._modelDB.amDoc[this._path] as List<T>).length
      : 0;
  }

  /**
   * Test whether the list has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources held by the list.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    this.clear();
  }

  /**
   * Create an iterator over the values in the list.
   *
   * @returns A new iterator starting at the front of the list.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   */
  iter(): IIterator<T> {
    return new ArrayIterator(this._modelDB.amDoc[this._path] as List<T>);
  }

  /**
   * Get the value at the specified index.
   *
   * @param index - The positive integer index of interest.
   *
   * @returns The value at the specified index.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral or out of range.
   */
  get(index: number): T {
    return (this._modelDB.amDoc[this._path] as List<T>)[index];
  }

  /**
   * Set the value at the specified index.
   *
   * @param index - The positive integer index of interest.
   *
   * @param value - The value to set at the specified index.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral or out of range.
   */
  set(index: number, value: T): void {
    const oldValue = (this._modelDB.amDoc[this._path] as List<T>)[index];
    if (value === undefined) {
      throw new Error('Cannot set an undefined item');
    }
    // Bail if the value does not change.
    const itemCmp = this._itemCmp;
    if (itemCmp(oldValue, value)) {
      return;
    }
    if (this._modelDB.isInitialized) {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list set ${this._path} ${index} ${value}`,
          doc => {
            (doc[this._path] as List<T>)[index] = value;
          }
        );
      });
    }
    this._changed.emit({
      type: 'set',
      oldIndex: index,
      newIndex: index,
      oldValues: [oldValue],
      newValues: [value]
    });
  }

  /**
   * Add a value to the end of the list.
   *
   * @param value - The value to add to the end of the list.
   *
   * @returns The new length of the list.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   */
  push(value: T): number {
//      if (this._modelDB.isInitialized) {
    this._lock(() => {
      this._modelDB.amDoc = Automerge.change(
        this._modelDB.amDoc,
        `list push ${this._path} ${value}`,
        doc => {
          (doc[this._path] as List<T>).push(value);
        }
      );
    });
    const num = (this._modelDB.amDoc[this._path] as List<T>).length;
    this._changed.emit({
      type: 'add',
      oldIndex: -1,
      newIndex: this.length - 1,
      oldValues: [],
      newValues: [value]
    });
    return num;
  }

  /**
   * Insert a value into the list at a specific index.
   *
   * @param index - The index at which to insert the value.
   *
   * @param value - The value to set at the specified index.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * The `index` will be clamped to the bounds of the list.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral.
   */
  insert(index: number, value: T): void {
//    if (this._modelDB.isInitialized) {
    this._lock(() => {
      this._modelDB.amDoc = Automerge.change(
        this._modelDB.amDoc,
        `list insert ${this._path} ${index} ${value}`,
        doc => {
          ArrayExt.insert(doc[this._path] as List<T>, index, value);
        }
      );
    });
    this._changed.emit({
      type: 'add',
      oldIndex: -1,
      newIndex: index,
      oldValues: [],
      newValues: [value]
    });
  }

  /**
   * Remove the first occurrence of a value from the list.
   *
   * @param value - The value of interest.
   *
   * @returns The index of the removed value, or `-1` if the value
   *   is not contained in the list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * Iterators pointing at the removed value and beyond are invalidated.
   */
  removeValue(value: T): number {
    const itemCmp = this._itemCmp;
    const index = ArrayExt.findFirstIndex(
      this._modelDB.amDoc[this._path] as List<T>,
      item => {
        return itemCmp(item, value);
      }
    );
    this.remove(index);
    return index;
  }

  /**
   * Remove and return the value at a specific index.
   *
   * @param index - The index of the value of interest.
   *
   * @returns The value at the specified index, or `undefined` if the
   *   index is out of range.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * Iterators pointing at the removed value and beyond are invalidated.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral.
   */
  remove(index: number): T | undefined {
    let value = undefined;
    if (this._modelDB.isInitialized) {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list remove ${this._path} ${index}`,
          doc => {
            value = ArrayExt.removeAt(doc[this._path] as List<T>, index);
          }
        );
      });
    }
    if (value === undefined) {
      return;
    }
    this._changed.emit({
      type: 'remove',
      oldIndex: index,
      newIndex: -1,
      newValues: [],
      oldValues: [value]
    });
    return value;
  }

  /**
   * Remove all values from the list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * All current iterators are invalidated.
   */
  clear(): void {
    if (this._modelDB.amDoc[this._path]) {
      const copy = (this._modelDB.amDoc[this._path] as List<T>).slice();
      if (this._modelDB.isInitialized) {
        this._lock(() => {
          this._modelDB.amDoc = Automerge.change(
            this._modelDB.amDoc,
            `list clear ${this._path}`,
            doc => {
              doc[this._path] = new Array<T>();
            }
          );
        });
      }
      this._changed.emit({
        type: 'remove',
        oldIndex: 0,
        newIndex: 0,
        newValues: [],
        oldValues: copy
      });
    }
  }

  /**
   * Move a value from one index to another.
   *
   * @parm fromIndex - The index of the element to move.
   *
   * @param toIndex - The index to move the element to.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * Iterators pointing at the lesser of the `fromIndex` and the `toIndex`
   * and beyond are invalidated.
   *
   * #### Undefined Behavior
   * A `fromIndex` or a `toIndex` which is non-integral.
   */
  move(fromIndex: number, toIndex: number): void {
    if (this.length <= 1 || fromIndex === toIndex) {
      return;
    }
    let values = Array<T>();
    if (this._modelDB.isInitialized) {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list move ${this._path} ${fromIndex} ${toIndex}`,
          doc => {
            values = [(doc[this._path] as List<T>)[fromIndex]];
            ArrayExt.move(doc[this._path] as List<T>, fromIndex, toIndex);
          }
        );
      });
    }
    this._changed.emit({
      type: 'move',
      oldIndex: fromIndex,
      newIndex: toIndex,
      oldValues: values,
      newValues: values
    });
  }

  /**
   * Push a set of values to the back of the list.
   *
   * @param values - An iterable or array-like set of values to add.
   *
   * @returns The new length of the list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   */
  pushAll(values: IterableOrArrayLike<T>): number {
    const newIndex = this.length;
    if (this._modelDB.isInitialized) {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list pushAll ${this._path} ${values}`,
          doc => {
            each(values, value => {
              (doc[this._path] as List<T>).push(value);
            });
          }
        );
      });
    }
    this._changed.emit({
      type: 'add',
      oldIndex: -1,
      newIndex,
      oldValues: [],
      newValues: toArray(values)
    });
    return this.length;
  }

  /**
   * Insert a set of items into the list at the specified index.
   *
   * @param index - The index at which to insert the values.
   *
   * @param values - The values to insert at the specified index.
   *
   * #### Complexity.
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * The `index` will be clamped to the bounds of the list.
   *
   * #### Undefined Behavior.
   * An `index` which is non-integral.
   */
  insertAll(index: number, values: IterableOrArrayLike<T>): void {
    const newIndex = index;
    if (this._modelDB.isInitialized) {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list insertAll ${this._path} ${index} ${values}`,
          doc => {
            each(values, value => {
              ArrayExt.insert(doc[this._path] as List<T>, index++, value);
            });
          }
        );
      });
    }
    this._changed.emit({
      type: 'add',
      oldIndex: -1,
      newIndex,
      oldValues: [],
      newValues: toArray(values)
    });
  }

  /**
   * Remove a range of items from the list.
   *
   * @param startIndex - The start index of the range to remove (inclusive).
   *
   * @param endIndex - The end index of the range to remove (exclusive).
   *
   * @returns The new length of the list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * Iterators pointing to the first removed value and beyond are invalid.
   *
   * #### Undefined Behavior
   * A `startIndex` or `endIndex` which is non-integral.
   */
  removeRange(startIndex: number, endIndex: number): number {
    const oldValues = (this._modelDB.amDoc[this._path] as List<T>).slice(
      startIndex,
      endIndex
    );
    if (this._modelDB.isInitialized) {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list removeRange ${this._path} ${startIndex} ${endIndex}`,
          doc => {
            for (let i = startIndex; i < endIndex; i++) {
              ArrayExt.removeAt(doc[this._path] as List<T>, startIndex);
            }
          }
        );
      });
    }
    this._changed.emit({
      type: 'remove',
      oldIndex: startIndex,
      newIndex: -1,
      oldValues,
      newValues: []
    });
    return this.length;
  }

  private _path: string;
  private _modelDB: AutomergeModelDB;
  private _observable: Observable;
  private _lock: any;
  private _isDisposed = false;
  private _itemCmp: (first: T, second: T) => boolean;
  private _changed = new Signal<this, IObservableList.IChangedArgs<T>>(this);
}

/**
 * The namespace for `ObservableList` class statics.
 */
export namespace AutomergeList {
  /**
   * The options used to initialize an observable map.
   */
  export interface IOptions<T> {
    /**
     * An optional initial set of values.
     */
    values?: IterableOrArrayLike<T>;

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
   * The default strict equality item cmp.
   */
  export function itemCmp(first: any, second: any): boolean {
    return first === second;
  }
}
