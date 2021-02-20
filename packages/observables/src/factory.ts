// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

// import { Token } from '@lumino/coreutils';

import { IModelDB, ModelDB } from './modeldb';

/**
 * The modeldb token.
 */
// export const IModelDBFactory = new Token<IModelDBFactory>('@jupyterlab/observables:IModelDBFactory');

/**
 * The main menu interface.
 */
export interface IModelDBFactory {
  /**
   * Add a new modelDB
   */
  newModelDB(): IModelDB;

}

export class ModelDBFactory implements IModelDBFactory {

  constructor() {
    console.log('--- new ModelDBFactory')
  }

  newModelDB(): IModelDB {
    console.log('--- newModelDB')
    return new ModelDB();
  }

}
