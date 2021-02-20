// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { AutomergeModelDB } from './ammodeldb';

import { IObservableJSON, ObservableJSON } from './../observablejson';

import { IObservableCell } from './../observablecell';

import { IObservableCodeEditor } from './../observablecodeeditor';

import { IObservableValue } from './../observablevalue';

import { AutomergeJSON } from './amjson';

import { AutomergeCodeEditor } from './amcodeeditor';

import { AutomergeValue } from './amvalue';

/**
 * A concrete Automerge map for Cell data.
 */
export class AutomergeCell extends AutomergeJSON implements IObservableCell {
  /**
   * Construct a new Automerge Cell object.
   */
  constructor(
    path: string[],
    modelDB: AutomergeModelDB,
    id: string,
    options: ObservableJSON.IOptions = {}
  ) {
    super(path, modelDB, { values: options.values });
    this._id = new AutomergeValue(path.concat('id'), modelDB, id);
    this._codeEditor = new AutomergeCodeEditor(path.concat('codeEditor'), modelDB);
    this._metadata = new AutomergeJSON(path.concat('metadata'), modelDB);
    this._cellType = new AutomergeValue(path.concat('cell_type'), modelDB, 'code');
    this._trusted = new AutomergeValue(path.concat('trusted'), modelDB, false);
    this._executionCount = new AutomergeValue(path.concat('execution_count'), modelDB, '');
  }

  public initObservable() {
    // Do not initialize `super`- Just initialize `composites`.
    this._id.initObservable();
    this._codeEditor.initObservable();
    this._metadata.initObservable();
    this._cellType.initObservable();
    this._trusted.initObservable();
    this._executionCount.initObservable();
  }

  set path(path: string[]) {
    this._path = path;
    this._id.path = path.concat('id');
    this._codeEditor.path = path.concat('codeEditor');
    this._metadata.path = path.concat('metadata');
    this._cellType.path = path.concat('cell_type');
    this._trusted.path = path.concat('trusted');
    this._executionCount.path = path.concat('execution_count');
  } 

  get id(): IObservableValue {
    return this._id;
  }

  get codeEditor(): IObservableCodeEditor {
    return this._codeEditor;
  }

  get metadata(): IObservableJSON {
    return this._metadata;
  }

  get cellType(): IObservableValue {
    return this._cellType;
  }

  get trusted(): IObservableValue {
    return this._trusted;
  }

  get executionCount(): IObservableValue {
    return this._executionCount;
  }

  private _id: IObservableValue;
  private _codeEditor: IObservableCodeEditor;
  private _metadata: IObservableJSON;
  private _cellType: IObservableValue;
  private _trusted: IObservableValue;
  private _executionCount: IObservableValue;
}
