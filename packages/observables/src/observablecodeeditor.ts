// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { IDisposable } from '@lumino/disposable';

import { ISignal, Signal } from '@lumino/signaling';

import { IObservable } from './modeldb';

import { IObservableValue, ObservableValue } from './observablevalue';

import { IObservableString, ObservableString } from './observablestring';

import { IObservableJSON, ObservableJSON } from './observablejson';

/**
 * A map which can be seen for changes.
 */
export interface IObservableCodeEditor extends IDisposable, IObservable {

  /**
   * TODO(ECH)
   */
  path: string[];

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

export class ObservableCodeEditor implements IObservableCodeEditor {
  constructor() {
    this._value = new ObservableString();
    this._mimeType = new ObservableValue('text/x-ipython');
    this._selections = new ObservableJSON();
  }

  public initObservable() {
    /* no-op */
  }

  /**
   * TODO(ECH)
   */
  set path(path: string[]) {
  }

  /**
   * The type of the Observable.
   */
  get type(): 'CodeEditor' {
    return 'CodeEditor';
  }

  /**
   * A signal emitted when the map has changed.
   */
  get changed(): ISignal<this, IObservableCodeEditor.IChangedArgs> {
    return this._changed;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get value(): IObservableString {
    return this._value;
  }

  get mimeType(): IObservableValue {
    return this._mimeType;
  }

  get selections(): IObservableJSON {
    return this._selections;
  }

  /**
   * Dispose of the resources held by the map.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
  }

  private _value: IObservableString;
  private _mimeType: IObservableValue;
  private _selections: IObservableJSON;
  private _changed = new Signal<this, IObservableCodeEditor.IChangedArgs>(this);
  private _isDisposed = false;
}

/**
 * The namespace for `ObservableCodeEditor` class statics.
 */
export namespace ObservableCodeEditor {
  /**
   * The options used to initialize an observable map.
   */
  export interface IOptions {
    /**
     * An optional initial set of values.
     */
    values?: { [key: string]: any };
  }
}
