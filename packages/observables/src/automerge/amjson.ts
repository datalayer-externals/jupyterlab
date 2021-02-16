// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JSONExt,
  PartialJSONObject,
  ReadonlyPartialJSONValue
} from '@lumino/coreutils';

import { AutomergeModelDB } from './ammodeldb';

import { AutomergeMap } from './ammap';

import { ObservableJSON } from './../observablejson';

/**
 * A concrete Automerge map for JSON data.
 */
export class AutomergeJSON extends AutomergeMap<ReadonlyPartialJSONValue> {
  /**
   * Construct a new automerge JSON object.
   */
  constructor(
    path: string[],
    modelDB: AutomergeModelDB,
    options: ObservableJSON.IOptions = {}
  ) {
    super(path, modelDB, {
      itemCmp: JSONExt.deepEqual,
      values: options.values
    });
  }

  public initObservable() {
    super.initObservable();
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
