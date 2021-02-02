// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JSONExt,
  JSONObject,
  PartialJSONObject,
  ReadonlyPartialJSONValue
} from '@lumino/coreutils';

import { Observable } from 'automerge';

import { AutomergeMap } from './ammap';

import { AutomergeModelDB } from './ammodeldb';

/**
 * A concrete Automerge map for JSON data.
 */
export class AutomergeJSON extends AutomergeMap<ReadonlyPartialJSONValue> {
  /**
   * Construct a new automerge JSON object.
   */
  constructor(
    path: string,
    modelDB: AutomergeModelDB,
    observable: Observable,
    lock: any,
    options: AutomergeJSON.IOptions = {}
  ) {
    super(path, modelDB, observable, lock, {
      itemCmp: JSONExt.deepEqual,
      values: options.values
    });
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
}

/**
 * The namespace for ObservableJSON static data.
 */
export namespace AutomergeJSON {
  /**
   * The options use to initialize an observable JSON object.
   */
  export interface IOptions {
    /**
     * The optional initial value for the object.
     */
    values?: JSONObject;
  }
}
