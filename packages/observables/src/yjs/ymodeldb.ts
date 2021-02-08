// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { DisposableSet } from '@lumino/disposable';

import { JSONValue } from '@lumino/coreutils';

import { IModelDB, IObservable, IObservableValue, ObservableValue } from './../modeldb';

import { ObservableMap, IObservableMap } from './../observablemap';

import { IObservableJSON, ObservableJSON } from './../observablejson';

import { IObservableString, ObservableString } from './../observablestring';

import { IObservableList, ObservableList } from './../observablelist';

import { IObservableCell, ObservableCell } from './../observablecell';

import { IObservableCodeEditor, ObservableCodeEditor } from './../observablecodeeditor';

import { IObservableNotebook  } from './../observablenotebook';

import {
  IObservableUndoableList,
  ObservableUndoableList
} from './../undoablelist';


/**
 * A .js implementation of an `IModelDB`.
 */
export class YModelDB implements IModelDB {
  /**
   * Constructor for the `ModelDB`.
   */
  constructor(options: YModelDB.ICreateOptions = {}) {
    this._basePath = options.basePath || '';

    if (options.baseDB) {
      this._db = options.baseDB;
    } else {
      this._db = new ObservableMap<IObservable>();
      this._toDispose = true;
    }
  }

  /**
   * The base path for the `ModelDB`. This is prepended
   * to all the paths that are passed in to the member
   * functions of the object.
   */
  get basePath(): string {
    return this._basePath;
  }

  /**
   * Whether the database is disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Whether the model has been populated with
   * any model values.
   */
  readonly isPrepopulated: boolean = false;

  /**
   * Whether the model is collaborative.
   */
  readonly isCollaborative: boolean = false;

  /**
   * A promise resolved when the model is connected
   * to its backend. For the in-memory ModelDB it
   * is immediately resolved.
   */
  readonly connected: Promise<void> = Promise.resolve(void 0);

  /**
   * Get a value for a path.
   *
   * @param path: the path for the object.
   *
   * @returns an `IObservable`.
   */
  get(path: string): IObservable | undefined {
    return this._db.get(this._resolvePath(path));
  }

  /**
   * Whether the `IModelDB` has an object at this path.
   *
   * @param path: the path for the object.
   *
   * @returns a boolean for whether an object is at `path`.
   */
  has(path: string): boolean {
    return this._db.has(this._resolvePath(path));
  }

  /**
   * Create a string and insert it in the database.
   *
   * @param path: the path for the string.
   *
   * @returns the string that was created.
   */
  createString(path: string): IObservableString {
    let str: IObservableString = new ObservableString();
    this._disposables.add(str);
    this.set(path, str);
    return str;
  }

  createList<T extends any>(path: string): IObservableList<T> {
    const vec = new ObservableList<T>();
    this._disposables.add(vec);
    this.set(path, vec);
    return vec;
  }

  /**
   * Create an undoable list and insert it in the database.
   *
   * @param path: the path for the list.
   *
   * @returns the list that was created.
   *
   * #### Notes
   * The list can only store objects that are simple
   * JSON Objects and primitives.
   */
  createUndoableList<T extends JSONValue>(
    path: string
  ): IObservableUndoableList<T> {
    const vec = new ObservableUndoableList<T>(
      new ObservableUndoableList.IdentitySerializer<T>()
    );
    this._disposables.add(vec);
    this.set(path, vec);
    return vec;
  }

  /**
   * Create a map and insert it in the database.
   *
   * @param path: the path for the map.
   *
   * @returns the map that was created.
   *   */
  createMap(path: string): IObservableMap<any> {
    const map = new ObservableJSON();
    this._disposables.add(map);
    this.set(path, map);
    return map;
  }

  /**
   * Create a map and insert it in the database.
   *
   * @param path: the path for the map.
   *
   * @returns the map that was created.
   *
   * #### Notes
   * The map can only store objects that are simple
   * JSON Objects and primitives.
   */
  createJSON(path: string): IObservableJSON {
    const map = new ObservableJSON();
    this._disposables.add(map);
    this.set(path, map);
    return map;
  }

  /**
   * TODO(ECH)
   */
  createCodeEditor(path: string): IObservableCodeEditor {
    const codeEditor = new ObservableCodeEditor();
    this._disposables.add(codeEditor);
    this.set(path, codeEditor);
    return codeEditor;
  }

  /**
   * TODO(ECH)
   */
  createNotebook(path: string): IObservableNotebook {
    throw new Error('createNotebook is not implemented by ModelDB')
  }

  /**
   * TODO(ECH)
   */
  createCell(path: string, id: string, codeEditor: IObservableCodeEditor): IObservableCell {
    const cell = new ObservableCell(id, codeEditor);
    this._disposables.add(cell);
    this.set(path, cell);
    return cell;
  }

  /**
   * Create an opaque value and insert it in the database.
   *
   * @param path: the path for the value.
   *
   * @returns the value that was created.
   */
  createValue(path: string): IObservableValue {
    const val = new ObservableValue();
    this._disposables.add(val);
    this.set(path, val);
    return val;
  }

  /**
   * Get a value at a path, or `undefined if it has not been set
   * That value must already have been created using `createValue`.
   *
   * @param path: the path for the value.
   */
  getValue(path: string): JSONValue | undefined {
    const val = this.get(path);
    if (!val || val.type !== 'Value') {
      throw Error('Can only call getValue for an ObservableValue');
    }
    return (val as ObservableValue).get();
  }

  /**
   * Set a value at a path. That value must already have
   * been created using `createValue`.
   *
   * @param path: the path for the value.
   *
   * @param value: the new value.
   */
  setValue(path: string, value: JSONValue): void {
    const val = this.get(path);
    if (!val || val.type !== 'Value') {
      throw Error('Can only call setValue on an ObservableValue');
    }
    (val as ObservableValue).set(value);
  }

  /**
   * Create a view onto a subtree of the model database.
   *
   * @param basePath: the path for the root of the subtree.
   *
   * @returns an `IModelDB` with a view onto the original
   *   `IModelDB`, with `basePath` prepended to all paths.
   */
  view(basePath: string): IModelDB {
    const view = new YModelDB({ basePath, baseDB: this });
    this._disposables.add(view);
    return view;
  }

  /**
   * Set a value at a path. Not intended to
   * be called by user code, instead use the
   * `create*` factory methods.
   *
   * @param path: the path to set the value at.
   *
   * @param value: the value to set at the path.
   */
  set(path: string, value: IObservable): void {
    this._db.set(this._resolvePath(path), value);
  }

  /**
   * Dispose of the resources held by the database.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    if (this._toDispose) {
      this._db.dispose();
    }
    this._disposables.dispose();
  }

  /**
   * Compute the fully resolved path for a path argument.
   */
  private _resolvePath(path: string): string {
    if (this._basePath) {
      path = this._basePath + '.' + path;
    }
    return path;
  }

  private _basePath: string;
  private _db: IModelDB | ObservableMap<IObservable>;
  private _toDispose = false;
  private _isDisposed = false;
  private _disposables = new DisposableSet();
}

/**
 * A namespace for the `ModelDB` class statics.
 */
export namespace YModelDB {
  /**
   * Options for creating a `ModelDB` object.
   */
  export interface ICreateOptions {
    /**
     * The base path to prepend to all the path arguments.
     */
    basePath?: string;

    /**
     * A ModelDB to use as the store for this
     * ModelDB. If none is given, it uses its own store.
     */
    baseDB?: IModelDB;

    localPath?: string;
  }

  /**
   * A factory interface for creating `IModelDB` objects.
   */
  export interface IFactory {
    /**
     * Create a new `IModelDB` instance.
     */
    createNew(path: string): IModelDB;
  }
}
