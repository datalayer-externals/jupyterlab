// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { IDisposable } from '@lumino/disposable';

import { ISignal } from '@lumino/signaling';

import { IObservable } from './modeldb';

import { IObservableJSON } from './observablejson';

import { IObservableList } from './observablelist';

import { IObservableCell } from './observablecell';

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
