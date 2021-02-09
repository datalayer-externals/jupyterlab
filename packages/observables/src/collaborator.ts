// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { IObservableMap } from './observablemap';

/**
 * Interface for an object representing a single collaborator
 * on a realtime model.
 */
export interface ICollaborator {
    /**
     * A user id for the collaborator.
     * This might not be unique, if the user has more than
     * one editing session at a time.
     */
    readonly userId: string;
  
    /**
     * A session id, which should be unique to a
     * particular view on a collaborative model.
     */
    readonly sessionId: string;
  
    /**
     * A human-readable display name for a collaborator.
     */
    readonly displayName: string;
  
    /**
     * A color to be used to identify the collaborator in
     * UI elements.
     */
    readonly color: string;
  
    /**
     * A human-readable short name for a collaborator, for
     * use in places where the full `displayName` would take
     * too much space.
     */
    readonly shortName: string;
  }
  
  /**
   * Interface for an IObservableMap that tracks collaborators.
   */
  export interface ICollaboratorMap extends IObservableMap<ICollaborator> {
    /**
     * The local collaborator on a model.
     */
    readonly localCollaborator: ICollaborator;
  }
  
  