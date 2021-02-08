// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import Automerge, { Observable, List, Text } from 'automerge';

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
          doc[this._path].cells = new Array<any>();
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
      this._modelDB.amDoc[this._path],
      (diff, before, after, local) => {
        console.log('--- diff', diff, after)
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

  private _obsCellToCell(obsCell: IObservableCell) {
    const cell = {
      source: new Text(obsCell.codeEditor.value.text)
    };
    return cell;
  }

  private _onCellsChanged(
    value: IObservableList<IObservableCell>,
    args: IObservableList.IChangedArgs<IObservableCell>
  ): void {
    waitForModelInit(this._modelDB, () => {
      this._lock(() => {
        /*
        const valueJson = new Array();
        const iter = value.iter();
        let elem = undefined;
        while ((elem = iter.next())) {
          valueJson.push(elem.toJSON());
        }
        const iter2 = value.iter();
        while ((elem = iter2.next())) {
          elem.codeEditor.value.changed.connect(this._onValueChanged, this);
        }
        */
        console.log('------', this._modelDB.amDoc[this._path])
        this._observable.observe(
          this._modelDB.amDoc[this._path].cells,
          (diff, before, after, local) => {
            console.log(`--- diff cells`, diff);
          });
        switch (args.type) {
          case 'add':
            console.log('--- amnotebook add', value, args)
            args.newValues.map(obsCell => {
              const cell = this._obsCellToCell(obsCell);
              this._modelDB.amDoc = Automerge.change(
                  this._modelDB.amDoc,
                  `cells add ${this._path} ${args.newIndex}`,
                  doc => {
                    args.newValues.map(obsCell => {
                      (doc[this._path].cells as List<any>).insertAt!(args.newIndex, cell);
                    });
                  });
                  obsCell.codeEditor.value.changed.connect(this._onValueChanged, this);
                  this._observable.observe(
                    this._modelDB.amDoc[this._path].cells[args.newIndex].source,
                    (diff, before, after, local) => {
                      console.log(`--- diff cell source index ${args.newIndex}`, diff);
                  });
                }
              );
            break;
          case 'move':
            console.log('--- amnotebook move', value, args)
            break;
         case 'remove':
            console.log('--- amnotebook remove', value, args)
            break;
          case 'set':
            console.log('--- amnotebook set', value, args)
            break;
        }
      });
    });
  }

  private _onValueChanged(
    value: IObservableString,
    args: IObservableString.IChangedArgs
  ): void {
      waitForModelInit(this._modelDB, () => {
        this._lock(() => {
          switch(args.type) {
            case 'set': {
              this._modelDB.amDoc = Automerge.change(
                this._modelDB.amDoc,
                `string set ${this._path} ${args.value}`,
                doc => {
                  (doc[this._path].cells as List<any>)[0].source = new Text(args.value);
                }
              );
              break;
            }
            case 'insert': { 
              this._modelDB.amDoc = Automerge.change(
                this._modelDB.amDoc,
                `string insert ${this._path} ${args.start} ${args.value}`,
                doc => {
                  ((doc[this._path].cells as List<any>)[0].source as Text).insertAt!(args.start, ...args.value);
                }
              );
              break;
            }
            case 'remove': {
              this._modelDB.amDoc = Automerge.change(
                this._modelDB.amDoc,
                `string remove ${this._path} ${args.start} ${args.end}`,
                doc => {
                  ((doc[this._path].cells as List<any>)[0].source as Text).deleteAt!(args.start, args.end - args.start);
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
