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
  readonly metadata: IObservableJSON;
  readonly cells: IObservableList<IObservableCell>;
  getCell(index: number): IObservableCell;
  setCell(index: number, cell: IObservableCell): IObservableCell;
  insertCell(index: number, cell: IObservableCell): IObservableCell;
  removeCell(index: number): void;
  removeCellsRange(startIndex: number, endIndex: number): void;
  moveCell(fromIndex: number, toIndex: number): void;
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
     * An entry was added.
     */
    | 'add'

    /**
     * An entry was removed.
     */
    | 'remove'

    /**
     * An entry was changed.
     */
    | 'change';

  /**
   * The changed args object which is emitted by an observable map.
   */
  export interface IChangedArgs {
    /**
     * The type of change undergone by the map.
     */
    type: ChangeType;

    index: number;

    cell: IObservableCell | undefined;
  }
}
