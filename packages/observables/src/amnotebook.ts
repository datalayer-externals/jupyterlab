// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import Automerge, { Observable } from 'automerge';

import { waitForModelInit, AutomergeModelDB } from './ammodeldb';

import { IObservableNotebook } from './observablenotebook';

import { AutomergeJSON } from './amjson';

import { IObservableJSON } from './observablejson';

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
    waitForModelInit(this._modelDB, () => {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `notebook init ${this._path}`,
          doc => {
            doc[this._path] = {};
          }
        );
      });
    });
  }

  public initObservables() {
    // Observe and Handle Remote Changes.
    this._observable.observe(
      this._modelDB.amDoc,
      (diff, before, after, local) => {
      }
    );
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

  createMetadata(): IObservableJSON {
    this._metadata = new AutomergeJSON(this._modelDB.idPath(this._path), this._modelDB, this._observable, this._lock);
    waitForModelInit(this._modelDB, () => {
      this._lock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `notebook create metadata ${this._path}`,
          doc => {
            doc[this._path]['metadata'] = this._metadata.toJSON();
          }
        );
      });
    });
    return this._metadata;
  }

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

  private _metadata: IObservableJSON;
  private _path: string;
  private _modelDB: AutomergeModelDB;
  private _observable: Observable;
  private _lock: any;
  private _changed = new Signal<this, IObservableNotebook.IChangedArgs>(this);
  private _isDisposed = false;
}

export namespace AutomergeNotebook {
  export interface IOptions {
    values?: { [key: string]: any };
  }
}
