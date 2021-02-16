// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import { JSONExt, JSONValue, PartialJSONValue } from '@lumino/coreutils';

import { IObservable } from './modeldb';
/**
 * Interface for an Observable object that represents
 * an opaque JSON value.
 */
export interface IObservableValue extends IObservable {
  /**
   * The type of this object.
   */
  readonly type: 'Value';

  /**
   * The changed signal.
   */
  readonly changed: ISignal<IObservableValue, ObservableValue.IChangedArgs>;

  /**
   * TODO(ECH)
   */
  path: string[];

  /**
   * Get the current value, or `undefined` if it has not been set.
   */
  get(): PartialJSONValue | undefined;

  /**
   * Set the value.
   */
  set(value: PartialJSONValue): void;
}

/**
 * A concrete implementation of an `IObservableValue`.
 */
export class ObservableValue implements IObservableValue {
  /**
   * Constructor for the value.
   *
   * @param initialValue: the starting value for the `ObservableValue`.
   */
  constructor(initialValue: JSONValue = null) {
    this._value = initialValue;
  }

  public initObservable() {
    /* no-op */
  }

  /**
   * The observable type.
   */
  get type(): 'Value' {
    return 'Value';
  }

  /**
   * TODO(ECH)
   */
  set path(path: string[]) {
  }

  /**
   * Whether the value has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * The changed signal.
   */
  get changed(): ISignal<this, ObservableValue.IChangedArgs> {
    return this._changed;
  }

  /**
   * Get the current value, or `undefined` if it has not been set.
   */
  get(): JSONValue {
    return this._value;
  }

  /**
   * Set the current value.
   */
  set(value: JSONValue): void {
    const oldValue = this._value;
    if (JSONExt.deepEqual(oldValue, value)) {
      return;
    }
    this._value = value;
    this._changed.emit({
      oldValue: oldValue,
      newValue: value
    });
  }

  /**
   * Dispose of the resources held by the value.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    this._value = null;
  }

  private _value: JSONValue = null;
  private _changed = new Signal<this, ObservableValue.IChangedArgs>(this);
  private _isDisposed = false;
}

/**
 * The namespace for the `ObservableValue` class statics.
 */
export namespace ObservableValue {
  /**
   * The changed args object emitted by the `IObservableValue`.
   */
  export class IChangedArgs {
    /**
     * The old value.
     */
    oldValue: JSONValue | undefined;

    /**
     * The new value.
     */
    newValue: JSONValue | undefined;
  }
}
