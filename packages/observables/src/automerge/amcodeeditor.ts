// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import { getNested, AutomergeModelDB } from './ammodeldb';

import { AutomergeString } from './amstring';

import { AutomergeValue } from './amvalue';

import { AutomergeJSON } from './amjson';

import { IObservableCodeEditor, ObservableCodeEditor } from './../observablecodeeditor';

import { IObservableValue } from './../observablevalue';

import { IObservableString } from './../observablestring';

import { IObservableJSON } from './../observablejson';

export class AutomergeCodeEditor implements IObservableCodeEditor {
  constructor(
    path: string[],
    modelDB: AutomergeModelDB,
    options: ObservableCodeEditor.IOptions = {}
  ) {
    this._path = path;
    this._modelDB = modelDB;
    this._value = new AutomergeString(this._path.concat('value'), this._modelDB);
    this._mimeType = new AutomergeValue(this._path.concat('mimeType'),this._modelDB, 'text/x-ipython');
    this._selections = new AutomergeJSON(this._path.concat('selections'), this._modelDB);
  }

  public initObservables() {
    /*
    // TODO(ECH)
    if (options.values) {
      for (const key in options.values) {
        getNested(this._path)[key] = options.values[key];
      }
    }
    */
    this._value.initObservables();
    this._mimeType.initObservables();
    this._selections.initObservables();
    this._modelDB.observable.observe(
      getNested(this._modelDB.document, this._path),
      (diff, before, after, local, changes, path) => {
        this._path = path as string[];
      }
    );
  }

  set path(path: string[]) {
    this._path = path;
    this._value.path = path.concat('value');
    this._mimeType.path = path.concat('mimeType');
    this._selections.path = path.concat('selections');
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
    if (getNested(this._modelDB.document, this._path)) {
      getNested(this._modelDB.document, this._path).clear();
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
