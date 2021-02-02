// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { DisposableSet } from '@lumino/disposable';

import { JSONValue, UUID } from '@lumino/coreutils';

import Automerge, { Observable } from 'automerge';

import { ObservableMap } from './observablemap';

import { IObservableJSON } from './observablejson';

import { IObservableString } from './observablestring';

import { AutomergeString } from './automergestring';

import { AutomergeJSON } from './automergejson';

import {
  IObservableUndoableList,
  ObservableUndoableList
} from './undoablelist';

import {
  ICollaboratorMap,
  IModelDB,
  ICollaborator,
  ModelDB,
  IObservable,
  IObservableValue,
  ObservableValue
} from './modeldb';

const CSS_COLOR_NAMES = [
  'Red',
  'Orange',
  'Olive',
  'Green',
  'Purple',
  'Fuchsia',
  'Lime',
  'Teal',
  'Aqua',
  'Blue',
  'Navy',
  'Black',
  'Gray',
  'Silver'
];

export class Collaborator implements ICollaborator {
  constructor(
    userId: string,
    sessionId: string,
    displayName: string,
    color: string,
    shortName: string
  ) {
    this._userId = userId;
    this._sessionId = sessionId;
    this._displayName = displayName;
    this._color = color;
    this._shortName = shortName;
  }
  get userId(): string {
    return this._userId;
  }
  get sessionId(): string {
    return this._sessionId;
  }
  get displayName(): string {
    return this._displayName;
  }
  get color(): string {
    return this._color;
  }
  get shortName(): string {
    return this._shortName;
  }
  private _userId: string;
  private _sessionId: string;
  private _displayName: string;
  private _color: string;
  private _shortName: string;
}

export class CollaboratorMap extends ObservableMap<ICollaborator> {
  constructor(localCollaborator: ICollaborator) {
    super();
    this._localCollaborator = localCollaborator;
    this.set(this.localCollaborator.userId, this.localCollaborator);
  }

  get localCollaborator(): ICollaborator {
    return this._localCollaborator;
  }

  private _localCollaborator: ICollaborator;
}

export const createLock = () => {
  let lock = true;
  return (a: any, b: any) => {
    if (lock) {
      lock = false;
      try {
        a();
      } finally {
        lock = true;
      }
    } else if (b !== undefined) {
      b();
    }
  };
};

export type AmDoc = {
  [uuid: string]: any;
};

/**
 * A automerge implementation of an `IModelDB`.
 */
export class AutomergeModelDB implements IModelDB {
  /**
   * Constructor for the `ModelDB`.
   */
  constructor(options: ModelDB.ICreateOptions = {}) {
    this._basePath = options.basePath || '';

    const splits = UUID.uuid4().split('-');
    const id = splits.join('');

    const localCollaborator = new Collaborator(
      id,
      id,
      `Me ${id}`,
      CSS_COLOR_NAMES[Math.floor(Math.random() * CSS_COLOR_NAMES.length)],
      `Me ${id.substr(0, 5)}`
    );
    this._collaborators = new CollaboratorMap(localCollaborator);

    this._actorId = localCollaborator.sessionId;

    if (options.baseDB) {
      this._db = options.baseDB;
    } else {
      this._db = new ObservableMap<IObservable>();
      this._toDispose = true;
    }

    const uri = encodeURI(
      `ws://localhost:4321/${this._actorId}/${options.localPath}`
    );
    this._ws = new WebSocket(uri);
    this._ws.binaryType = 'arraybuffer';

    this._observable = new Observable();
    this._lock = createLock();
    this._amDoc = Automerge.init<AmDoc>({
      actorId: this._actorId,
      observable: this._observable
    });

    // Listen to Local Changes.
    this._observable.observe(this._amDoc, (diff, before, after, local) => {
      this._amDoc = after;
      if (local) {
        const changes = Automerge.getChanges(before, after);
        // Get the total length of all arrays.
        let length = 0;
        changes.forEach(item => {
          length += item.length;
        });
        // Create a new array with total length and merge all source arrays.
        let combined = new Uint8Array(length);
        let offset = 0;
        changes.forEach(item => {
          combined.set(item, offset);
          offset += item.length;
        });
        this._ws.send(combined);
      }
    });

    // Listen to Remote Changes.
    this._ws.addEventListener('message', (message: MessageEvent) => {
      if (message.data) {
        const changes = new Uint8Array(message.data);
        //        Automerge.Frontend.setActorId(this._amDoc, this._actorId);
        this._lock(() => {
          this._amDoc = Automerge.applyChanges(this._amDoc, [changes]);
          if (!this._amDoc['selections']) {
            this._amDoc = Automerge.change(this._amDoc, doc => {
              doc['selections'] = {};
            });
          }
          if (!this._amDoc['selections'][this._actorId]) {
            this._amDoc = Automerge.change(this._amDoc, doc => {
              doc['selections'][this._actorId] = [];
            });
          }
          Object.keys(this._amDoc['selections']).map(uuid => {
            if (!this.collaborators.get(uuid)) {
              const collaborator = new Collaborator(
                uuid,
                uuid,
                `Anonymous ${uuid}`,
                CSS_COLOR_NAMES[
                  Math.floor(Math.random() * CSS_COLOR_NAMES.length)
                ],
                `Anonymous ${uuid.substr(0, 5)}`
              );
              this.collaborators.set(uuid, collaborator);
            }
          });
        });
        /*
        if (!this._amDoc.cursors) {
          this._amDoc = Automerge.change(this._amDoc, doc => {
            doc.cursors = {};
          });
        }
        if (!this._amDoc.cursors[this._actorId]) {
          this._amDoc = Automerge.change(this._amDoc, doc => {
            doc.cursors[this._actorId] = doc.text.getCursorAt(
              doc.text.toString().length - 1
            );
          });
        }
        Object.keys(this._amDoc.cursors).map(userId => {
          console.log(
            '--- Cursor Index',
            userId,
            Automerge.getCursorIndex(
              this._amDoc,
              this._amDoc.cursors[userId],
              true
            )
          );
        });
        */
      }
    });
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

  get amDoc(): AmDoc {
    return this._amDoc;
  }

  set amDoc(amDoc: AmDoc) {
    this._amDoc = amDoc;
  }

  /**
   * Whether the model has been populated with
   * any model values.
   */
  readonly isPrepopulated: boolean = false;

  /**
   * Whether the model is collaborative.
   */
  readonly isCollaborative: boolean = true;

  get collaborators(): ICollaboratorMap {
    return this._collaborators;
  }

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
    let str: IObservableString = new AutomergeString(
      path,
      this,
      this._observable
    );
    this._disposables.add(str);
    this.set(path, str);
    return str;
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
  createList<T extends JSONValue>(path: string): IObservableUndoableList<T> {
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
   *
   * #### Notes
   * The map can only store objects that are simple
   * JSON Objects and primitives.
   */
  createMap(path: string): IObservableJSON {
    const map = new AutomergeJSON(path, this, this._observable, this._lock);
    this._disposables.add(map);
    this.set(path, map);
    return map;
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
  view(basePath: string): ModelDB {
    console.log('---', basePath);
    const view = new ModelDB({ basePath, baseDB: this });
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

  private _ws: WebSocket;
  private _actorId: string;
  private _amDoc: AmDoc;
  private _observable: Observable;
  private _lock: any;
  private _collaborators: ICollaboratorMap;
  private _basePath: string;
  private _db: IModelDB | ObservableMap<IObservable>;
  private _toDispose = false;
  private _isDisposed = false;
  private _disposables = new DisposableSet();
}

/**
 * A namespace for the `ModelDB` class statics.
 */
export namespace AutomergeModelDB {
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
    baseDB?: ModelDB;
  }
}
