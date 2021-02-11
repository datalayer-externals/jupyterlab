// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JSONExt,
  PartialJSONObject,
  JSONObject,
  ReadonlyPartialJSONValue,
} from '@lumino/coreutils';

import { Message } from '@lumino/messaging';

import { IObservableMap } from './observablemap';

import { IObservableJSON, ObservableJSON } from './observablejson';

import { IObservableCodeEditor } from './observablecodeeditor';

import { IObservableValue, ObservableValue } from './observablevalue';

/**
 * An observable Cell value.
 */
export interface IObservableCell extends IObservableJSON {
  readonly id: string;
  readonly codeEditor: IObservableCodeEditor;
  readonly metadata: IObservableJSON;
  readonly cellType: IObservableValue;
  readonly trusted: IObservableValue;
  readonly executionCount: IObservableValue;
}

/**
 * The namespace for IObservableCell related interfaces.
 */
export namespace IObservableCell {
  /**
   * A type alias for observable JSON changed args.
   */
  export type IChangedArgs = IObservableMap.IChangedArgs<
    ReadonlyPartialJSONValue
  >;
}

/**
 * A concrete Observable map for JSON data.
 */
export class ObservableCell extends ObservableJSON {
  /**
   * Construct a new observable JSON object.
   */
  constructor(id: string, codeEditor: IObservableCodeEditor, options: ObservableCell.IOptions = {}) {
    super({
      values: options.values
    });
    this._id = id;
    this._codeEditor = codeEditor;
    this._metadata = new ObservableJSON();
    this._cellType = new ObservableValue('code');
    this._trusted = new ObservableValue('');
    this._executionCount =  new ObservableValue('');
  }

  public initObservables() {
    /* no-op */
  }

  get id(): string {
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

  /**
   * Serialize the model to JSON.
   */
  toJSON(): PartialJSONObject {
    const out: PartialJSONObject = Object.create(null);
    const keys = this.keys();
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        out[key] = JSONExt.deepCopy(value) as PartialJSONObject;
      }
    }
    out['source'] = this._codeEditor.value.text;
    out['mimeType'] = this._codeEditor.mimeType.get();
    out['metadata'] = this._metadata.toJSON();
    out['cellType'] = this._cellType.get();
    out['trusted'] = this._trusted.get();
    out['executionCount'] = this._executionCount.get();
    return out;
  }

  private _id: string;
  private _codeEditor: IObservableCodeEditor;
  private _metadata: IObservableJSON;
  private _cellType: IObservableValue;
  private _trusted: IObservableValue;
  private _executionCount: IObservableValue;
}

/**
 * The namespace for ObservableCell static data.
 */
export namespace ObservableCell {
  /**
   * The options use to initialize an observable JSON object.
   */
  export interface IOptions {
    /**
     * The optional initial value for the object.
     */
    values?: JSONObject;
  }

  /**
   * An observable JSON change message.
   */
  export class ChangeMessage extends Message {
    /**
     * Create a new metadata changed message.
     */
    constructor(type: string, args: IObservableCell.IChangedArgs) {
      super(type);
      this.args = args;
    }

    /**
     * The arguments of the change.
     */
    readonly args: IObservableCell.IChangedArgs;
  }
}
