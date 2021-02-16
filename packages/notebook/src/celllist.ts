// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ArrayExt,
  IIterator,
  IterableOrArrayLike,
  each,
  toArray,
  ArrayIterator 
} from '@lumino/algorithm';

import { ISignal, Signal } from '@lumino/signaling';

import { ICellModel } from '@jupyterlab/cells';

import {
  IObservableMap,
  ObservableMap,
  IObservableList,
  IModelDB,
  IObservableCell,
  IObservableNotebook,
  ObservableCell
} from '@jupyterlab/observables';

import { NotebookModel } from './model';

/**
 * A cell list object that supports undo/redo.
 */
export class CellList implements IObservableList<ICellModel> {
  /**
   * Construct the cell list.
   */
  constructor(modelDB: IModelDB, factory: NotebookModel.IContentFactory) {
    this._factory = factory;
    this._modelDB = modelDB;
    this._cellMap = new ObservableMap<ICellModel>();
    this._notebook = modelDB.get('notebook') as IObservableNotebook;
    this._cells = this._notebook.cells;
    this._cells.changed.connect(this._onCellsChanged, this);
  }

  type: 'List';

  public initObservables() {
    /* no-op */
  }

  /**
   * A signal emitted when the cell list has changed.
   */
  get changed(): ISignal<this, IObservableList.IChangedArgs<ICellModel>> {
    return this._changed;
  }

  /**
   * Test whether the cell list has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Test whether the list is empty.
   *
   * @returns `true` if the cell list is empty, `false` otherwise.
   *
   * #### Notes
   * This is a read-only property.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   */
  get isEmpty(): boolean {
    return this._cells.length === 0;
  }

  /**
   * Get the length of the cell list.
   *
   * @return The number of cells in the cell list.
   *
   * #### Notes
   * This is a read-only property.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   */
  get length(): number {
    return this._cells.length;
  }

  /**
   * Create an iterator over the cells in the cell list.
   *
   * @returns A new iterator starting at the front of the cell list.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   */
  iter(): IIterator<ICellModel> {
    if (this._cells.length === 0) {
      return new ArrayIterator<ICellModel>([]);
    }
    const arr: ICellModel[] = [];
    const iter = this._cells.iter();
    const cells = toArray(iter);
    for (const cell of cells) {
      arr.push(this._cellMap.get(this._getCellId(cell))!);
    }
    /*
    for (let i=0; i < this._cells.length; i++) {
      const c = this._cells.get(i);
      const id = this._getCellId(c);
      const c2 = this._cellMap.get(id)!;
      arr.push(c2);
    }
    */
    return new ArrayIterator<ICellModel>(arr);
  }

  /**
   * Dispose of the resources held by the cell list.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    // Clean up the cell map and cell order objects.
    for (const cell of this._cellMap.values()) {
      cell.dispose();
    }
    this._cellMap.dispose();
    this._cells.dispose();
  }

  /**
   * Get the cell at the specified index.
   *
   * @param index - The positive integer index of interest.
   *
   * @returns The cell at the specified index.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral or out of range.
   */
  get(index: number): ICellModel {
    const cell = this._cells.get(index);
    const id = this._getCellId(cell)
    return this._cellMap.get(id)!;
  }

  /**
   * Set the cell at the specified index.
   *
   * @param index - The positive integer index of interest.
   *
   * @param cell - The cell to set at the specified index.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral or out of range.
   *
   * #### Notes
   * This should be considered to transfer ownership of the
   * cell to the `CellList`. As such, `cell.dispose()` should
   * not be called by other actors.
   */
  set(index: number, cell: ICellModel): void {
    // Set the internal data structures.
//    this._ensureCollaborativeCell(index, cell);
    this._addToMap(cell.id, cell);
    this._cells.set(index, cell.observableCell);
  }

  /**
   * Add a cell to the back of the cell list.
   *
   * @param cell - The cell to add to the back of the cell list.
   *
   * @returns The new length of the cell list.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * This should be considered to transfer ownership of the
   * cell to the `CellList`. As such, `cell.dispose()` should
   * not be called by other actors.
   */
  push(cell: ICellModel): number {
    // Set the internal data structures.
    this.insert(this._cells.length, cell);
    return this._cells.length;
  }

  /**
   * Insert a cell into the cell list at a specific index.
   *
   * @param index - The index at which to insert the cell.
   *
   * @param cell - The cell to set at the specified index.
   *
   * @returns The new length of the cell list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * The `index` will be clamped to the bounds of the cell list.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral.
   *
   * #### Notes
   * This should be considered to transfer ownership of the
   * cell to the `CellList`. As such, `cell.dispose()` should
   * not be called by other actors.
   */
  insert(index: number, cell: ICellModel): void {
    // Set the internal data structures.
    this._addToMap(cell.id, cell);
    this._cells.insert(index, cell.observableCell);
//    this._ensureCollaborativeCell(index, cell);
  }

  /**
   * Remove the first occurrence of a cell from the cell list.
   *
   * @param cell - The cell of interest.
   *
   * @returns The index of the removed cell, or `-1` if the cell
   *   is not contained in the cell list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * Iterators pointing at the removed cell and beyond are invalidated.
   */
  removeValue(cell: ICellModel): number {
    const index = ArrayExt.findFirstIndex(
      toArray(this._cells),
      id => this._cellMap.get(cell.id) === cell
    );
    this.remove(index);
    return index;
  }

  /**
   * Remove and return the cell at a specific index.
   *
   * @param index - The index of the cell of interest.
   *
   * @returns The cell at the specified index, or `undefined` if the
   *   index is out of range.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * Iterators pointing at the removed cell and beyond are invalidated.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral.
   */
  remove(index: number): ICellModel {
    const c = this._cells.get(index);
    this._cells.remove(index);
    const cell = this._cellMap.get(this._getCellId(c))!;
    return cell;
  }

  /**
   * Remove all cells from the cell list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * All current iterators are invalidated.
   */
  clear(): void {
    this._cells.clear();
  }

  /**
   * Move a cell from one index to another.
   *
   * @parm fromIndex - The index of the element to move.
   *
   * @param toIndex - The index to move the element to.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * Iterators pointing at the lesser of the `fromIndex` and the `toIndex`
   * and beyond are invalidated.
   *
   * #### Undefined Behavior
   * A `fromIndex` or a `toIndex` which is non-integral.
   */
  move(fromIndex: number, toIndex: number): void {
    this._cells.move(fromIndex, toIndex);
  }

  /**
   * Push a set of cells to the back of the cell list.
   *
   * @param cells - An iterable or array-like set of cells to add.
   *
   * @returns The new length of the cell list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * This should be considered to transfer ownership of the
   * cells to the `CellList`. As such, `cell.dispose()` should
   * not be called by other actors.
   */
  pushAll(cells: IterableOrArrayLike<ICellModel>): number {
    const newValues = toArray(cells);
    each(newValues, cell => {
      // Set the internal data structures.
      this._addToMap(cell.id, cell);
      this._cells.push(cell.observableCell);
    });
    return this.length;
  }

  /**
   * Insert a set of items into the cell list at the specified index.
   *
   * @param index - The index at which to insert the cells.
   *
   * @param cells - The cells to insert at the specified index.
   *
   * @returns The new length of the cell list.
   *
   * #### Complexity.
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * The `index` will be clamped to the bounds of the cell list.
   *
   * #### Undefined Behavior.
   * An `index` which is non-integral.
   *
   * #### Notes
   * This should be considered to transfer ownership of the
   * cells to the `CellList`. As such, `cell.dispose()` should
   * not be called by other actors.
   */
  insertAll(index: number, cells: IterableOrArrayLike<ICellModel>): number {
    const newValues = toArray(cells);
    each(newValues, cell => {
      this._addToMap(cell.id, cell);
//      this._cells.beginCompoundOperation();
      this._cells.insert(index++, cell.observableCell);
//      this._cells.endCompoundOperation();
    });
    return this.length;
  }

  /**
   * Remove a range of items from the cell list.
   *
   * @param startIndex - The start index of the range to remove (inclusive).
   *
   * @param endIndex - The end index of the range to remove (exclusive).
   *
   * @returns The new length of the cell list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * Iterators pointing to the first removed cell and beyond are invalid.
   *
   * #### Undefined Behavior
   * A `startIndex` or `endIndex` which is non-integral.
   */
  removeRange(startIndex: number, endIndex: number): number {
    this._cells.removeRange(startIndex, endIndex);
    return this.length;
  }

  /**
   * Whether the object can redo changes.
   */
  get canRedo(): boolean {
//    return this._cells.canRedo;
    return false;
  }

  /**
   * Whether the object can undo changes.
   */
  get canUndo(): boolean {
//    return this._cells.canUndo;
    return false;
  }

  /**
   * Begin a compound operation.
   *
   * @param isUndoAble - Whether the operation is undoable.
   *   The default is `true`.
   */
  beginCompoundOperation(isUndoAble?: boolean): void {
//    this._cells.beginCompoundOperation(isUndoAble);
  }

  /**
   * End a compound operation.
   */
  endCompoundOperation(): void {
//    this._cells.endCompoundOperation();
  }

  /**
   * Undo an operation.
   */
  undo(): void {
//    this._cells.undo();
  }

  /**
   * Redo an operation.
   */
  redo(): void {
//    this._cells.redo();
  }

  /**
   * Clear the change stack.
   */
  clearUndo(): void {
    // Dispose of cells not in the current
    // cell order.
    /*
    for (const key of this._cellMap.keys()) {
      if (
        ArrayExt.findFirstIndex(toArray(this._cells), id => id === key) ===
        -1
      ) {
        const cell = this._cellMap.get(key) as ICellModel;
        cell.dispose();
        this._cellMap.delete(key);
      }
    }
    this._cells.clearUndo();
    */
  }

  private _addToMap(id: string, cell: ICellModel) {
    this._cellMap.set(id, cell);
  }

  private _getCellId(cell: any) {
    // TODO(ECH) Revisit this...
    try {
      return cell.id.get();
    }
    catch(e) {
      return cell.id.value;
    }
  }

  private _ensureCollaborativeCell(index: number, cell: ICellModel) {
    if (cell.observableCell instanceof ObservableCell) {
      const collaborativeCell = this._modelDB.createCell(['notebook', 'cells', index.toString()], cell.id);
      cell.observableCell = collaborativeCell;
      this._cells.set(index, collaborativeCell);
    }
  }

  private _onCellsChanged(
    order: IObservableList<IObservableCell>,
    change: IObservableList.IChangedArgs<IObservableCell>
  ): void {
    if (change.type === 'add' || change.type === 'set') {
      each(change.newValues, c => {
        let cell: ICellModel | undefined = this._cellMap.get(this._getCellId(c));
        if (!cell) {
          const cellType = this._factory.modelDB!.createValue(this._getCellId(c) + '.type');
          switch (cellType.get()) {
            case 'code':
              cell = this._factory.createCodeCell({ id: this._getCellId(c) });
              break;
            case 'markdown':
              cell = this._factory.createMarkdownCell({ id: this._getCellId(c) });
              break;
            default:
              cell = this._factory.createCodeCell({ id: this._getCellId(c) });
              break;
          }
          cell.observableCell = c;
          this._addToMap(this._getCellId(c), cell);
        }
        this._ensureCollaborativeCell(change.newIndex, cell);
      });
    }
    const newValues: ICellModel[] = [];
    const oldValues: ICellModel[] = [];
    each(change.newValues, cell => {
      const newCell = this._cellMap.get(this._getCellId(cell))!;
      newValues.push(newCell);
    });
    each(change.oldValues, cell => {
      const oldCell = this._cellMap.get(this._getCellId(cell))!;
      oldValues.push(oldCell);
    });
    this._changed.emit({
      type: change.type,
      oldIndex: change.oldIndex,
      newIndex: change.newIndex,
      oldValues,
      newValues
    });
  }

  private _isDisposed: boolean = false;
  private _notebook: IObservableNotebook;
  private _cells: IObservableList<IObservableCell>;
  private _cellMap: IObservableMap<ICellModel>;
  private _changed = new Signal<this, IObservableList.IChangedArgs<ICellModel>>(
    this
  );
  private _modelDB: IModelDB;
  private _factory: NotebookModel.IContentFactory;
}
