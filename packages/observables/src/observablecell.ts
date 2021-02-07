// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JSONExt,
  JSONObject,
  PartialJSONObject,
  ReadonlyPartialJSONValue
} from '@lumino/coreutils';

import { Message } from '@lumino/messaging';

import { IObservableMap, ObservableMap } from './observablemap';

import { IObservableJSON, ObservableJSON } from './observablejson';

import { IObservableValue, ObservableValue } from './modeldb';

/**
 * An observable Cell value.
 */
export interface IObservableCell
  extends IObservableMap<ReadonlyPartialJSONValue | undefined> {
  readonly metadata: IObservableJSON;
  readonly cellType: IObservableValue;
  readonly trusted: IObservableValue;
  readonly executionCount: IObservableValue;
  /**
   * Serialize the model to Cell.
   */
  toJSON(): PartialJSONObject;
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
export class ObservableCell extends ObservableMap<ReadonlyPartialJSONValue> {
  /**
   * Construct a new observable JSON object.
   */
  constructor(options: ObservableCell.IOptions = {}) {
    super({
      itemCmp: JSONExt.deepEqual,
      values: options.values
    });

    this._metadata = new ObservableJSON();
    this._cellType = new ObservableValue('');
    this._trusted = new ObservableValue('');
    this._executionCount =  new ObservableValue('');

  }

  public initObservables() {
    // no-op
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
    return out;
  }

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
