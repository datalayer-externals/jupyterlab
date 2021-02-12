// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import { amDocPath, AutomergeModelDB } from './ammodeldb';

import { IObservableCodeEditor } from './../observablecodeeditor';

import { IObservableValue } from './../observablevalue';

import { IObservableString } from './../observablestring';

import { AutomergeString } from './amstring';

import { IObservableJSON } from './../observablejson';

import { AutomergeValue } from './amvalue';

import { AutomergeJSON } from './amjson';

export class AutomergeCodeEditor implements IObservableCodeEditor {
  constructor(
    path: string[],
    modelDB: AutomergeModelDB,
    options: AutomergeCodeEditor.IOptions = {}
  ) {
    this._path = path;
    this._modelDB = modelDB;
    this._value = new AutomergeString(this._path.concat('value'), this._modelDB);
    this._mimeType = new AutomergeValue(this._path.concat('mimeType'),this._modelDB, '');
    this._selections = new AutomergeJSON(this._path.concat('selections'), this._modelDB);
    /*
    if (options.values) {
      for (const key in options.values) {
        amDocPath(this._path)[key] = options.values[key];
      }
    }
    */
  }

  public initObservables() {
    this._value.initObservables();
    this._mimeType.initObservables();
    this._selections.initObservables();
    if (this._value.text.length === 0) {
      this._value.insert(0, `Welcome to the Jupyter RTC Server 👍

What can I do for you?`);
    }
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
    if (amDocPath(this._modelDB.amDoc, this._path)) {
      amDocPath(this._modelDB.amDoc, this._path).clear();
    }
  }

  private _path: string[];
  private _modelDB: AutomergeModelDB;
  private _value: IObservableString;
  private _mimeType: IObservableValue;
  private _selections: IObservableJSON;
  private _changed = new Signal<this, IObservableCodeEditor.IChangedArgs>(this);
  private _isDisposed = false;
}

/**
 * The namespace for `ObservableCodeEditor` class statics.
 */
export namespace AutomergeCodeEditor {
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
