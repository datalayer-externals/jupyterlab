// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import Automerge, { Observable } from 'automerge';

import { waitForModelInit, AutomergeModelDB } from './ammodeldb';

import { IObservableNotebook } from '../observablenotebook';

import { IObservableJSON, ObservableJSON } from '../observablejson';

import { IObservableCell } from '../observablecell';

import { IObservableList, ObservableList } from '../observablelist';

import { IObservableString } from '../observablestring';

import { IObservableMap } from '../observablemap';

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

    this._metadata = new ObservableJSON();
    this._metadata.changed.connect(this._onMetadataChanged, this);

    this._cells = new ObservableList();
    this._cells.changed.connect(this._onCellsChanged, this);

    this._lock(() => {
      this._modelDB.amDoc = Automerge.change(
        this._modelDB.amDoc,
        `notebook init ${this._path}`,
        doc => {
          doc[this._path] = {};
          doc[this._path].metadata = this.metadata.toJSON();
          doc[this._path].cells = [];
        }
      );
    });
    /*
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
*/
  }

  public initObservables() {
    this._observeRemote();
  }

  // Observe and Handle Remote Changes.
  private _observeRemote() {
    this._observable.observe(
      this._modelDB.amDoc,
      (diff, before, after, local) => {
        console.log('---', diff);
        if (!local && diff.props && diff.props[this._path]) {
        }
      }
    );
  }

  private _onMetadataChanged(
    value: IObservableMap<any>,
    args: IObservableMap.IChangedArgs<any>
  ): void {
    waitForModelInit(this._modelDB, () => {
      this._lock(() => {
        switch (args.type) {
          case 'add': {
            this._modelDB.amDoc = Automerge.change(
              this._modelDB.amDoc,
              `notebook metadata add ${this._path} ${args.key}`,
              doc => {
                doc[this._path].metadata[args.key] = args.newValue;
              }
            );
            break;
          }
          case 'remove': {
            this._modelDB.amDoc = Automerge.change(
              this._modelDB.amDoc,
              `notebook metadata delete ${this._path} ${args.key}`,
              doc => {
                delete doc[this._path].metadata[args.key];
              }
            );
            break;
          }
          case 'change': {
            this._modelDB.amDoc = Automerge.change(
              this._modelDB.amDoc,
              `notebook metadata change ${this._path} ${args.key}`,
              doc => {
                doc[this._path].metadata[args.key] = args.newValue;
              }
            );
            break;
          }
        }
      });
    });
  }

  private _onCellsChanged(
    value: IObservableList<IObservableCell>,
    args: IObservableList.IChangedArgs<IObservableCell>
  ): void {
    waitForModelInit(this._modelDB, () => {
      this._lock(() => {
        const valueJson = new Array();
        const valueIt = value.iter();
        let elem = undefined;
        while ((elem = valueIt.next())) {
          valueJson.push(elem.toJSON());
        }
        const valueIt2 = value.iter();
        while ((elem = valueIt2.next())) {
          elem.codeEditor.value.changed.connect(this._onValueChanged, this);
        }
        switch (args.type) {
          case 'add':
            this._modelDB.amDoc = Automerge.change(
              this._modelDB.amDoc,
              `cells add ${this._path} ${args.newIndex}`,
              doc => {
                doc[this._path].cells = valueJson;
              }
            );
            break;
          case 'move':
            this._modelDB.amDoc = Automerge.change(
              this._modelDB.amDoc,
              `cells move ${this._path} ${args.newIndex}`,
              doc => {
                doc[this._path].cells = valueJson;
              }
            );
            break;
          case 'remove':
            this._modelDB.amDoc = Automerge.change(
              this._modelDB.amDoc,
              `cells remove ${this._path} ${args.newIndex}`,
              doc => {
                doc[this._path].cells = valueJson;
              }
            );
            break;
          case 'set':
            this._modelDB.amDoc = Automerge.change(
              this._modelDB.amDoc,
              `cells set ${this._path} ${args.newIndex}`,
              doc => {
                doc[this._path].cells = valueJson;
              }
            );
            break;
        }
      });
    });
  }

  private _onValueChanged(
    value: IObservableString,
    args: IObservableString.IChangedArgs
  ): void {
//    console.log('---', value, args);
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
    if (this._modelDB.amDoc[this._path]) {
      this._modelDB.amDoc[this._path].clear();
    }
  }

  private _metadata: IObservableJSON;
  private _cells: IObservableList<IObservableCell>;
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
