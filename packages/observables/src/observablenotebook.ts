// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { IDisposable } from '@lumino/disposable';

import { ISignal } from '@lumino/signaling';

import { IObservable } from './modeldb';

import { IObservableJSON } from './observablejson';

import { IObservableList } from './observablelist';

import { IObservableCell } from './observablecell';

/**
 * A notebook which can be observed for changes.
 */
export interface IObservableNotebook extends IDisposable, IObservable {
  type: 'Notebook';
  readonly changed: ISignal<this, IObservableList.IChangedArgs<IObservableCell>>;
  readonly metadata: IObservableJSON;
  readonly cells: IObservableList<IObservableCell>;
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
