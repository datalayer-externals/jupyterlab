// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { IDisposable } from '@lumino/disposable';

import { ISignal, Signal } from '@lumino/signaling';

import { IObservable } from './modeldb';

import { IObservableJSON, ObservableJSON } from './observablejson';

import { IObservableList, ObservableList } from './observablelist';

import { IObservableCell, ObservableCell } from './observablecell';

/**
 * A notebook which can be seen for changes.
 */
export interface IObservableNotebook extends IDisposable, IObservable {
  type: 'Notebook';
  readonly changed: ISignal<this, IObservableNotebook.IChangedArgs>;
  readonly cellOrderChanged: ISignal<this, IObservableList.IChangedArgs<string>>;
  readonly metadata: IObservableJSON;
  readonly cellOrder: IObservableList<string>;
  getCell(id: string): IObservableCell;
  setCell(index: number, cell: IObservableCell): void;
  insertCell(index: number, cell: IObservableCell): void;
  removeCell(index: number): void;
  removeCellsRange(startIndex: number, endIndex: number): void;
  moveCell(fromIndex: number, toIndex: number): void;
  clear(): void;
  dispose(): void;
}

/**
 * The interfaces associated with an IObservableNotebook.
 */
export namespace IObservableNotebook {
  /**
   * The change types which occur on an observable map.
   */
  export type ChangeType =
    /**
     * Item(s) were added to the list.
     */
    | 'add'

    /**
     * An item was moved within the list.
     */
    | 'move'

    /**
     * Item(s) were removed from the list.
     */
    | 'remove'

    /**
     * An item was set in the list.
     */
    | 'set';

  /**
   * The changed args object which is emitted by an observable map.
   */
  export interface IChangedArgs {
    /**
     * The type of change undergone by the vector.
     */
    type: ChangeType;

    /**
     * The new index associated with the change.
     */
    newIndex: number;

    /**
     * The new values associated with the change.
     *
     * #### Notes
     * The values will be contiguous starting at the `newIndex`.
     */
    newValues: any[];

    /**
     * The old index associated with the change.
     */
    oldIndex: number;

    /**
     * The old values associated with the change.
     *
     * #### Notes
     * The values will be contiguous starting at the `oldIndex`.
     */
    oldValues: any[];
  }
}

export class ObservableNotebook implements IObservableNotebook {
  constructor(
    options: ObservableNotebook.IOptions = {}
  ) {
    this._metadata = new ObservableJSON();
    this._cellOrder = new ObservableList();
  }

  public initObservable() {
    this._metadata.initObservable();
    this._cellOrder.initObservable();
    if (this._cellOrder.length === 0) {
      const cell = new ObservableCell('init-cell-id-1')
      this._getOrCreateObservableCell(cell);
      this.insertCell(0, cell);
    }
    else {
      for (let i=0; i < this._cellOrder.length; i++) {
        this._cellOrderChanged.emit({
          type: 'add',
          oldIndex: -1,
          newIndex: i,
          oldValues: [],
          newValues: [this._cellOrder.get(i)]
        });
      }
    }
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
    return this._getOrCreateObservableCell(new ObservableCell(id));
  }

  setCell(index: number, cell: IObservableCell) {
    this._cellOrder.set(index, cell.id.get() as string);
  }

  insertCell(index: number, cell: IObservableCell): void {
    const amCell = this._getOrCreateObservableCell(cell);
    this._cellOrder.insert(index, amCell.id.get() as string);
  }

  removeCell(index: number): void {
    this._cellOrder.remove(index);
  }

  removeCellsRange(startIndex: number, endIndex: number): void {
    this._cellOrder.removeRange(startIndex, endIndex);
  }

  moveCell(fromIndex: number, toIndex: number): void {
    this._cellOrder.move(fromIndex, toIndex);
  }

  clear(): void {
    this._cellOrder.clear();
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

  private _getOrCreateObservableCell(cell: IObservableCell): IObservableCell {
    const amCell = new ObservableCell(cell.id.get() as string);
    amCell.initObservable();
    return amCell;
  }

  private _changed = new Signal<this, IObservableNotebook.IChangedArgs>(this);
  private _cellOrderChanged = new Signal<this, IObservableList.IChangedArgs<string>>(this);
  private _metadata: IObservableJSON;
  private _cellOrder: IObservableList<string>;
  private _isDisposed = false;
}

export namespace ObservableNotebook {
  export interface IOptions {
    values?: { [key: string]: any };
  }
}
