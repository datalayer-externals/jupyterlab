// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { IDisposable } from '@lumino/disposable';

import { ISignal } from '@lumino/signaling';

import { IObservable } from './modeldb';

import { IObservableString } from './observablestring';

import { IObservableValue } from './modeldb';

import { IObservableJSON } from './observablejson';

/**
 * A map which can be observed for changes.
 */
export interface IObservableCodeEditor extends IDisposable, IObservable {
  /**
   * The type of the Observable.
   */
  type: 'CodeEditor';

  /**
   * A signal emitted when the CodeEditor has changed.
   */
  readonly changed: ISignal<this, IObservableCodeEditor.IChangedArgs>;

  readonly value: IObservableString;

  readonly mimeType: IObservableValue;

  readonly selections: IObservableJSON;

  /**
   * Dispose of the resources held by the map.
   */
  dispose(): void;
}

/**
 * The interfaces associated with an IObservableCodeEditor.
 */
export namespace IObservableCodeEditor {
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

    /**
     * The key of the change.
     */
    key: string;

    /**
     * The old value of the change.
     */
    oldValue: any | undefined;

    /**
     * The new value of the change.
     */
    newValue: any | undefined;
  }
}
