// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import Automerge from 'automerge';

import { 
  getNested,
  waitOnAmDocInit,
  AutomergeModelDB
} from './ammodeldb';

import { IObservableNotebook } from '../observablenotebook';

import { IObservableCell } from '../observablecell';

import { IObservableJSON } from '../observablejson';

import { AutomergeJSON } from './amjson';

import { AutomergeList } from './amlist';

import { IObservableList } from '../observablelist';

import { IObservableMap } from '../observablemap';

import { AutomergeCell } from './amcell';

export class AutomergeNotebook implements IObservableNotebook {
  constructor(
    path: string[],
    modelDB: AutomergeModelDB,
    options: AutomergeNotebook.IOptions = {}
  ) {
    this._path = path;
    this._modelDB = modelDB;
    this._metadata = new AutomergeJSON(this._path.concat('metadata'),this._modelDB);
    this._metadata.changed.connect(this._onMetadataChanged, this);
    this._cells = new AutomergeList(this._path.concat('cells'), this._modelDB);
  }

  public initObservables() {
    this._metadata.initObservables();
    this._cells.initObservables();
    const cellId = 'init-cell-1';
    const cell = new AutomergeCell(['notebook', 'cells', '0'], this._modelDB, cellId);
    this._cells.insert(0, cell);
  }

  private _onMetadataChanged(
    value: IObservableMap<any>,
    args: IObservableMap.IChangedArgs<any>
  ): void {
    waitOnAmDocInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        switch (args.type) {
          case 'add': {
            this._modelDB.amDoc = Automerge.change(
              this._modelDB.amDoc,
              `notebook metadata add ${this._path} ${args.key}`,
              doc => {
                getNested(doc, this._path).metadata[args.key] = args.newValue;
              }
            );
            break;
          }
          case 'remove': {
            this._modelDB.amDoc = Automerge.change(
              this._modelDB.amDoc,
              `notebook metadata delete ${this._path} ${args.key}`,
              doc => {
                delete getNested(doc, this._path).metadata[args.key];
              }
            );
            break;
          }
          case 'change': {
            this._modelDB.amDoc = Automerge.change(
              this._modelDB.amDoc,
              `notebook metadata change ${this._path} ${args.key}`,
              doc => {
                getNested(doc, this._path).metadata[args.key] = args.newValue;
              }
            );
            break;
          }
        }
      });
    });
  }

  get type(): 'Notebook' {
    return 'Notebook';
  }

  get changed(): ISignal<this, IObservableNotebook.IChangedArgs> {
    return this._changed;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get metadata(): IObservableJSON {
    return this._metadata;
  }

  get cells(): IObservableList<IObservableCell> {
    return this._cells;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    // TODO(ECH) Implement this.
    /*
    if (this._modelDB.amgetNested(doc, this._path)) {
      this._modelDB.amgetNested(doc, this._path).clear();
    }
    */
  }

  private _metadata: IObservableJSON;
  private _cells: IObservableList<IObservableCell>;
  private _path: string[];
  private _modelDB: AutomergeModelDB;
  private _changed = new Signal<this, IObservableNotebook.IChangedArgs>(this);
  private _isDisposed = false;
}

export namespace AutomergeNotebook {
  export interface IOptions {
    values?: { [key: string]: any };
  }
}
