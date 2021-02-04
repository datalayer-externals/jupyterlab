// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { JSONValue } from '@lumino/coreutils';

import { IObservableList } from './observablelist';

import { IObservableUndoableList } from './undoablelist';

import { AutomergeModelDB } from './ammodeldb';

import { IModelDB, IObservable } from './modeldb';

export class AutomergeModelDBView implements IModelDB {

  constructor(basePath: string, automergeModelDB: AutomergeModelDB) {
    this._basePath = basePath;
    this._automergeModelDB = automergeModelDB;
  }

  get basePath() {
    return this._basePath
  }

  get isDisposed() {
    return this._automergeModelDB.isDisposed;
  }

  get isPrepopulated() {
    return this._automergeModelDB.isPrepopulated;
  }

  get isCollaborative() {
    return this._automergeModelDB.isCollaborative;
  }

  get connected() {
    return this._automergeModelDB.connected;
  }

  get collaborators() {
    return this._automergeModelDB.collaborators;
  }

  get uuid() {
    return this._automergeModelDB.uuid;
  }

  public get(path: string) {
    return this._automergeModelDB.get(this._viewedPath(path));
  }

  public set(path: string, value: IObservable) {
    return this._automergeModelDB.set(this._viewedPath(path), value);
  }

  public has(path: string) {
    return this._automergeModelDB.has(this._viewedPath(path));
  }

  public createString(path: string) {
    return this._automergeModelDB.createString(this._viewedPath(path));
  }

  public createList<T extends JSONValue>(path: string): IObservableList<T>  {
    return this._automergeModelDB.createList(this._viewedPath(path));
  }

  public createUndoableList<T extends JSONValue>(
    path: string
  ): IObservableUndoableList<T> {
    return this._automergeModelDB.createUndoableList(this._viewedPath(path));
  }

  public createMap(path: string) {
    return this._automergeModelDB.createMap(this._viewedPath(path));
  }

  public createValue(path: string) {
    return this._automergeModelDB.createValue(this._viewedPath(path));
  }

  public getValue(path: string) {
    return this._automergeModelDB.getValue(this._viewedPath(path));
  }

  public setValue(path: string, value: JSONValue) {
    return this._automergeModelDB.setValue(this._viewedPath(path), value);
  }

  public view(basePath: string) {
    return this._automergeModelDB.view(basePath);
  }

  public dispose() {
    return this._automergeModelDB.dispose();
  }

  private _viewedPath(path: string) {
    return this._basePath + '_' + path;
  }

  private _basePath: string;
  private _automergeModelDB: AutomergeModelDB;
}
