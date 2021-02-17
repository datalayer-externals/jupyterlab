// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import { amDocPath, AutomergeModelDB } from './ammodeldb';

import { IObservableNotebook } from '../observablenotebook';

import { IObservableCell, ObservableCell } from '../observablecell';

import { IObservableJSON } from '../observablejson';

import { AutomergeJSON } from './amjson';

import { AutomergeList } from './amlist';

import { IObservableList } from '../observablelist';

import { AutomergeCell } from './amcell';

// import { AutomergeCell } from './amcell';

export class AutomergeNotebook implements IObservableNotebook {
  constructor(
    path: string[],
    modelDB: AutomergeModelDB,
    options: AutomergeNotebook.IOptions = {}
  ) {
    this._path = path;
    this._modelDB = modelDB;
    this._metadata = new AutomergeJSON(this._path.concat('metadata'), this._modelDB);
    this._cellOrder = new AutomergeList(this._path.concat('cellOrder'), this._modelDB);
  }

  public initObservable() {
    this._metadata.initObservable();
    this._cellOrder.initObservable();
    const cellOrder = this._modelDB.amDoc.notebook.cellOrder as [];
    if (cellOrder.length === 0) {
      const cell = new ObservableCell('init-cell-id-1')
      this.createCell(cell);
      this.insertCell(0, cell);
    }
    else {
      for (let i=0; i < cellOrder.length; i++) {
        this._cellOrderChanged.emit({
          type: 'add',
          oldIndex: -1,
          newIndex: i,
          oldValues: [],
          newValues: [cellOrder[i]]
        });
      }
    }
    // Observe and Handle Changes.
    this._modelDB.observable.observe(
      amDocPath(this._modelDB.amDoc, this._path.concat('cellOrder')),
      (diff, before, after, local, changes, path) => {
        if (!local && diff.edits) {
          const action = diff.edits[0].action;
          const index = diff.edits[0].index;
          const cellId = (after as any[])[index];
          const value = after[index];
          // 'add' 'move' 'remove' 'set'
          switch(action) {
            case 'insert':
              this._cellOrder.insert(index, value);
              this._cellOrderChanged.emit({
                type: 'add',
                oldIndex: -1,
                newIndex: index,
                oldValues: [],
                newValues: [cellId]
              });
              break
            case 'remove':
              this._cellOrderChanged.emit({
                type: 'remove',
                oldIndex: index,
                newIndex: -1,
                oldValues: [cellId],
                newValues: []
              });
              break
          }
        }
      }
    );    
  }

  get type(): 'Notebook' {
    return 'Notebook';
  }

  get changed(): ISignal<this, IObservableNotebook.IChangedArgs> {
    return this._changed;
  }

  get cellOrderChanged(): ISignal<this, IObservableList.IChangedArgs<string>> {
    return this._cellOrderChanged;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get metadata(): IObservableJSON {
    return this._metadata;
  }

  get cellOrder(): IObservableList<string> {
    return this._cellOrder;
  }
  
  getCell(id: string): IObservableCell {
    return this.createCell(new ObservableCell(id));
  }

  setCell(index: number, cell: IObservableCell) {
    this._cellOrder.set(index, cell.id.get() as string);
  }

  createCell(cell: IObservableCell): IObservableCell {
    const amCell = new AutomergeCell(['notebook', 'cells', cell.id.get() as string], this._modelDB, cell.id.get() as string);
    amCell.initObservable();
    return amCell;
  }

  insertCell(index: number, cell: IObservableCell): void {
    this.createCell(cell);
    this._cellOrder.insert(index, cell.id.get() as string);
  }

  removeCell(index: number): void {
    throw new Error('removeCell is not implemented by AutomergeNotebook');
  }

  removeCellsRange(startIndex: number, endIndex: number): void {
    throw new Error('removeCellsRange is not implemented by AutomergeNotebook');
  }

  moveCell(fromIndex: number, toIndex: number): void {
    this._cellOrder.move(fromIndex, toIndex);
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
  private _cellOrder: IObservableList<string>;
  private _path: string[];
  private _modelDB: AutomergeModelDB;
  private _changed = new Signal<this, IObservableNotebook.IChangedArgs>(this);
  private _cellOrderChanged = new Signal<this, IObservableList.IChangedArgs<string>>(this);
  private _isDisposed = false;
}

export namespace AutomergeNotebook {
  export interface IOptions {
    values?: { [key: string]: any };
  }
}
