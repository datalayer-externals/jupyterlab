// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import { AutomergeModelDB } from './ammodeldb';

import { IObservableNotebook } from '../observablenotebook';

import { IObservableCell, ObservableCell } from '../observablecell';

import { IObservableJSON } from '../observablejson';

import { AutomergeJSON } from './amjson';

import { AutomergeList } from './amlist';

import { IObservableList } from '../observablelist';

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
    this._cells = new AutomergeList(this._path.concat('cells'), this._modelDB);
  }

  public initObservables() {
    this._metadata.initObservables();
    this._cells.initObservables();
    const cells = this._modelDB.amDoc.notebook.cells as [];
    if (cells.length === 0) {
      const cellId = 'init-cell-id-1';
      const observableCell = new ObservableCell(cellId);
      this.insertCell(0, observableCell);
    }
    else {
      for (let i=0; i < cells.length; i++) {
        const cell = cells[i] as any;
        const cellId = cell.id;
        const observableCell = new ObservableCell(cellId);
        this.insertCell(i, observableCell);
      } 
    }
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
  
  getCell(index: number): IObservableCell {
    throw new Error('getCell is not implemented by AutomergeNotebook');
  }

  setCell(index: number, cell: IObservableCell): IObservableCell {
    throw new Error('setCell is not implemented by AutomergeNotebook');
  }

  insertCell(index: number, cell: IObservableCell): IObservableCell {
    throw new Error('insertCell is not implemented by AutomergeNotebook');
    /*
    if (cell instanceof ObservableCell) {
      cell = new AutomergeCell(['notebook', 'cells', index.toString()], this._modelDB, cell.id.get() as string);
    }
    return cell;
    */
    /*
    const cell = new AutomergeCell(path, this, id);
    waitOnAmDocInit(this, () => cell.initObservables());
    this._disposables.add(cell);
    this.set(path[0], cell);
    */
  }

  removeCell(index: number): void {
    throw new Error('removeCell is not implemented by AutomergeNotebook');
  }

  removeCellsRange(startIndex: number, endIndex: number): void {
    throw new Error('removeCellsRange is not implemented by AutomergeNotebook');
  }

  moveCell(fromIndex: number, toIndex: number): void {
    throw new Error('moveCell is not implemented by AutomergeNotebook');
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
