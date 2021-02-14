// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { DisposableSet } from '@lumino/disposable';

import { JSONValue, UUID } from '@lumino/coreutils';

import Automerge, { Observable } from 'automerge';

import { IModelDB, ModelDB, IObservable } from '../modeldb';

import {
  ICollaboratorMap,
  CollaboratorMap,
  Collaborator
} from './../collaborator';

import { AutomergeList } from './amlist';

import { AutomergeString } from './amstring';

import { AutomergeMap } from './ammap';

import { AutomergeJSON } from './amjson';

import { AutomergeCodeEditor } from './amcodeeditor';

import { AutomergeNotebook } from './amnotebook';

import { AutomergeValue } from './amvalue';

import { AutomergeCell } from './amcell';

import { IObservableNotebook } from '../observablenotebook';

import { IObservableList } from '../observablelist';

import { ObservableMap, IObservableMap } from '../observablemap';

import { IObservableJSON } from '../observablejson';

import { IObservableCell } from '../observablecell';

import { IObservableString } from '../observablestring';

import { IObservableValue, ObservableValue } from './../observablevalue';

import { IObservableCodeEditor } from '../observablecodeeditor';

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

const SHORT_ID_NUMBER_OF_CHARS = 7;

// const WS_READY_STATE_CONNECTING = 0
const WS_READY_STATE_OPEN = 1;

// Make the function wait until the connection is made...
function waitOnSocketReady(socket: WebSocket, callback: any) {
  if (socket.readyState === WS_READY_STATE_OPEN) {
    callback();
  } else
    setTimeout(function () {
      if (socket.readyState === WS_READY_STATE_OPEN) {
        callback();
      } else {
        waitOnSocketReady(socket, callback);
      }
    }, 10); // Wait 10 miliseconds for websocket to be ready...
}

// Make the function wait until the mode is initialized...
export function waitOnAmDocInit(modelDB: AutomergeModelDB, callback: any) {
  if (modelDB.isInitialized) {
    callback();
  } else
    setTimeout(function () {
      if (modelDB.isInitialized) {
        callback();
      } else {
        waitOnAmDocInit(modelDB, callback);
      }
    }, 10); // Wait 10 miliseconds for automerge document initialization...
}

export const combineChanges = (changes: Uint8Array[]) => {
  // Get the total length of all arrays.
  let length = 0;
  changes.forEach(item => {
    length += item.length;
  });
  // Create a new array with total length and merge all source arrays.
  let combinedChanges = new Uint8Array(length);
  let offset = 0;
  changes.forEach(change => {
    combinedChanges.set(change, offset);
    offset += change.length;
  });
  return combinedChanges;
};
/*
export const getNested = (doc: any, path: string[]) => {
  const out = [doc];
  for (let i = 0; i < path.length; i++) {
    if (!out[i][path[i]]) {
      return undefined;
    }
    let { [path[i]]: name } = out[i];
    out.push(name);
  }
  return out[out.length - 1];
};
*/
export const getNested = (doc: any, path: string[]) => {
  let nest = doc;
  for (let i = 0; i < path.length; i++) {
    nest = nest[path[i]]
    if (!nest) {
      return undefined;
    }
  }
  return nest;
};

export const setForcedNested = (doc: any, path: string[], value: any) => {
  let leaf = doc;
  for (let i = 0; i < path.length - 1; i++) {
    if (!leaf[path[i]]) {
      // TODO(ECH) Revisit this...
      if (path[i] === 'cells') {
        leaf[path[i]] = [];
      } else {
        leaf[path[i]] = {};
      }
    }
    leaf = leaf[path[i]];
  }
  leaf[path[path.length - 1]] = value;
};

export const amDocPath = (doc: any, path: string[]) => {
  let leaf: any = doc;
  for (let i = 0; i < path.length; i++) {
    leaf = leaf[path[i]];
    if (!leaf) {
      return undefined;
    }
  }
  return leaf;
}

const createLock = () => {
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

    this._id = this._basePath;

    this._actorId = UUID.uuid4().split('-').join('');
    this._actorShortId = this._actorId.substr(0, SHORT_ID_NUMBER_OF_CHARS);

    const localCollaborator = new Collaborator(
      this._actorId,
      this._actorId,
      `Me ${this._actorId}`,
      CSS_COLOR_NAMES[Math.floor(Math.random() * CSS_COLOR_NAMES.length)],
      `Me ${this._actorShortId}`
    );
    this._collaborators = new CollaboratorMap(localCollaborator);

    if (options.baseDB) {
      this._db = options.baseDB;
    } else {
      this._db = new ObservableMap<IObservable>();
      this._toDispose = true;
    }

    let params = '';
    if (options.localPath?.endsWith('md')) {
      params = params + 'initialize';
    }
    const uri = encodeURI(
      `ws://localhost:4321/${this._actorId}/${options.localPath}?${params}`
//      `ws://${location.hostname}:${location.port}/jupyter_rtc_proxy/${this._actorId}/${options.localPath}?${params}`
    );
    this._ws = new WebSocket(uri);
    this._ws.binaryType = 'arraybuffer';

    this._observable = new Observable();
    this._lock = createLock();
    this._amDoc = Automerge.init<AmDoc>({
      //      actorId: this._actorId,
      observable: this._observable
    });

    this._isInitialized = false;

    /**
     * Observe Local Changes.
     */
    this._observable.observe(
      this._amDoc,
      (diff, before, after, local, changes, path) => {
        if (local) {
          const combinedChanges = combineChanges(changes);
          waitOnSocketReady(this._ws, () => {
            this._ws.send(combinedChanges);
          });
        }
      }
    );

    // Listen to Remote Changes.
    this._ws.addEventListener('message', (message: MessageEvent) => {
      if (message.data) {
        this.withLock(() => {
          // Check Owner ID.
          if (this._amDoc['ownerId']) {
            Automerge.Frontend.setActorId(this._amDoc, this._amDoc['ownerId']);
          }
          // Apply the changes.
          const changes = new Uint8Array(message.data);
          this._amDoc = Automerge.applyChanges(this._amDoc, [changes]);
          // Check users.
          if (!this._amDoc['users']) {
            this._amDoc = Automerge.change(this._amDoc, 
              `users init`, 
              doc => {
              doc['users'] = {};
            });
          }
          if (!this._amDoc['users'][this._actorId]) {
            this._amDoc = Automerge.change(
              this._amDoc,
              `users add ${this._actorId}`,
              doc => {
                doc['users'][this._actorId] = true;
              }
            );
          }
          Object.keys(this._amDoc['users']).map(uuid => {
            if (!this.collaborators.get(uuid)) {
              const collaborator = new Collaborator(
                uuid,
                uuid,
                `Anonymous ${uuid}`,
                CSS_COLOR_NAMES[
                  Math.floor(Math.random() * CSS_COLOR_NAMES.length)
                ],
                `Anonymous ${uuid.substr(0, SHORT_ID_NUMBER_OF_CHARS)}`
              );
              this.collaborators.set(uuid, collaborator);
            }
          });
          if (!this.isInitialized) {
            /*
            // Initalize for Observables if not yet the case.
            (this._db as ObservableMap<any>).values().map(value => {
              value.initObservables();
            });
            */
            this._isInitialized = true;
          }
        });
      }
    });
  }

  withLock(callback: any) {
    this._lock(() => callback());
  }

  get observable(): Observable {
    return this._observable;
  }

  /**
   * TODO(ECH)
   */
  get id(): string {
    return this._id;
  }

  /**
   * The base path for the `ModelDB`. This is prepended
   * to all the paths that are passed in to the member
   * functions of the object.
   */
  get basePath(): string {
    return this._basePath;
  }

  get ws(): WebSocket {
    return this._ws;
  }

  get isInitialized() {
    return this._isInitialized;
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
  readonly isPrepopulated: boolean = true;

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
   * Create a string and insert it in the database.
   *
   * @param path: the path for the string.
   *
   * @returns the string that was created.
   */
  createString(path: string): IObservableString {
    let str: IObservableString = new AutomergeString([this.idPath(path)], this);
    waitOnAmDocInit(this, () => str.initObservables());
    this._disposables.add(str);
    this.set(path, str);
    return str;
  }

  createList<T extends IObservableCell>(path: string): IObservableList<T> {
    const list = new AutomergeList<T>([this.idPath(path)], this);
    waitOnAmDocInit(this, () => list.initObservables());
    this._disposables.add(list);
    this.set(path, list);
    return list;
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
  /*
  createUndoableList<T extends JSONValue>(
    path: string
  ): IObservableUndoableList<T> {
    const list = new AutomergeUndoableList<T>(
      [this.idPath(path)],
      this,
      new ObservableUndoableList.IdentitySerializer<T>()
    );
    waitOnAmDocInit(this, () => list.initObservables());
    this._disposables.add(list);
    this.set(path, list);
    return list;
  }
  */
  /**
   * Create a map and insert it in the database.
   *
   * @param path: the path for the map.
   *
   * @returns the map that was created.
   *
   */
  createMap(path: string): IObservableMap<any> {
    const map = new AutomergeMap([this.idPath(path)], this);
    waitOnAmDocInit(this, () => map.initObservables());
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
    const json = new AutomergeJSON([this.idPath(path)], this);
    waitOnAmDocInit(this, () => json.initObservables());
    this._disposables.add(json);
    this.set(path, json);
    return json;
  }

  public createCodeEditor(path: string): IObservableCodeEditor {
    const codeEditor = new AutomergeCodeEditor([this.idPath(path)], this);
    waitOnAmDocInit(this, () => codeEditor.initObservables());
    this._disposables.add(codeEditor);
    this.set(path, codeEditor);
    return codeEditor;
  }

  public createCell(path: string[], id: string): IObservableCell {
    const cell = new AutomergeCell(path, this, id);
    waitOnAmDocInit(this, () => cell.initObservables());
    this._disposables.add(cell);
    this.set(path[0], cell);
    return cell;
  }

  public createNotebook(path: string): IObservableNotebook {
    const notebook = new AutomergeNotebook([this.idPath(path)], this);
    waitOnAmDocInit(this, () => notebook.initObservables());
    this._disposables.add(notebook);
    this.set(path, notebook);
    return notebook;
  }

  /**
   * Create an opaque value and insert it in the database.
   *
   * @param path: the path for the value.
   *
   * @returns the value that was created.
   */
  createValue(path: string): IObservableValue {
    const val = new AutomergeValue([this.idPath(path)], this);
    waitOnAmDocInit(this, () => val.initObservables());
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
//    const view = new AutomergeModelDBView(basePath, this);
    const view = new ModelDB({ basePath, baseDB: this });
    this._disposables.add(view);
    return view;
  }

  /**
   * Get a value for a path.
   *
   * @param path: the path for the object.
   *
   * @returns an `IObservable`.
   */
  get(path: string): IObservable | undefined {
    return this._db.get(this._resolvePath(this.idPath(path)));
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
    this._db.set(this._resolvePath(this.idPath(path)), value);
  }

  /**
   * Whether the `IModelDB` has an object at this path.
   *
   * @param path: the path for the object.
   *
   * @returns a boolean for whether an object is at `path`.
   */
  has(path: string): boolean {
    return this._db.has(this._resolvePath(this.idPath(path)));
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

  public idPath(path: string) {
    return this._id === '' ? path : this._id + '_' + path;
  }

  private _id: string;
  private _ws: WebSocket;
  private _actorId: string;
  private _actorShortId: string;
  private _amDoc: AmDoc;
  private _lock: any;
  private _observable: Observable;
  private _isInitialized: boolean;
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
