// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import Automerge, { Observable, Text } from 'automerge';

import { waitForModelInit, AutomergeModelDB } from './ammodeldb';

import { IObservableCodeEditor } from './../observablecodeeditor';

import { IObservableValue, ObservableValue } from './../modeldb';

import { IObservableString, ObservableString } from './../observablestring';

import { IObservableJSON, ObservableJSON } from './../observablejson';

import { IObservableMap } from './../observablemap';

export class AutomergeCodeEditor implements IObservableCodeEditor {
  constructor(
    path: string,
    modelDB: AutomergeModelDB,
    observable: Observable,
    lock: any,
    options: AutomergeCodeEditor.IOptions = {}
  ) {
    this._path = path;
    this._modelDB = modelDB;
    this._observable = observable;
    this._lock = lock;

    this._value = new ObservableString();
    this._value.changed.connect(this._onValueChanged, this);

    this._mimeType = new ObservableValue('');
    this._mimeType.changed.connect(this._onMimeTypeChanged, this);

    this._selections = new ObservableJSON();
    this._selections.changed.connect(this._onSelectionsChanged, this);

    if (options.values) {
      for (const key in options.values) {
        this._modelDB.amDoc[this._path][key] = options.values[key];
      }
    }
  }

  public initObservables() {
    this._lock(() => {
      this._modelDB.amDoc = Automerge.change(
        this._modelDB.amDoc,
        `codeeditor init ${this._path}`,
        doc => {
          doc[this._path] = {};
          doc[this._path].value = new Text(this._value.text);
          doc[this._path].mimeType = this.mimeType.get();
          doc[this._path].selections = this.selections.toJSON();
        }
      );
    });
    this._observeRemote();
  }

  // Observe and Handle Remote Changes.
  private _observeRemote() {
    this._observable.observe(
      this._modelDB.amDoc,
      (diff, before, after, local) => {
        if (!local && diff.props && diff.props[this._path]) {
          const codeEditor = diff.props[this._path]
          Object.values(codeEditor).map(val => {
            const props = (val as any).props;
            if (props) {
              // Update Value.
              if (props.value) {
                Object.values(props.value).map(v1 => {
                  const editProps = v1 as any;
                  const edits = editProps.edits;
                  if (edits) {
                    const props = editProps.props;
                    if (props) {
                      let propsMap = new Map<any, string>();
                      Object.keys(props).map(key => {
                        const s = props[key];
                        const t = Object.keys(s)[0];
                        propsMap.set(t, (s[t] as any).value as string);
                      });
                      for (let i = 0; i < edits.length; i++) {
                        const edit = edits[i];
                        let value = propsMap.get(edit.elemId);
                        if ((edit.action === 'set') && (value)) {
                          this._value.text = value;
                        }
                        if ((edit.action === 'insert') && (value)) {
                          this._value.insert(edit.index, value);
                        }
                        if (edit.action === 'remove') {
                          if (!value) value = ' ';
                          this._value.remove(edit.index, edit.index + value.length);
                        }
                      }
                    }
                  }
                });
              }
              // Update Selections.
              if (props.selections) {
                Object.keys(after[this._path]['selections']).map(uuid => {
                  if (before[this._path]['selections']) {
                    /*
                    const oldVal = before[this._path]['selections']
                      ? before[this._path]['selections'][uuid]
                      : undefined;
                    */
                    const newVal = after[this._path]['selections']
                      ? after[this._path]['selections'][uuid]
                      : undefined;
                    this.selections.set(uuid, newVal);
                  }
                });
              }
            }
          });
        }
      }
    );
  }

  private _onValueChanged(
    value: IObservableString,
    args: IObservableString.IChangedArgs
  ): void {
      waitForModelInit(this._modelDB, () => {
        this._lock(() => {
          switch(args.type) {
            case 'set': {
              this._modelDB.amDoc = Automerge.change(
                this._modelDB.amDoc,
                `string set ${this._path} ${args.value}`,
                doc => {
                  doc[this._path].value = new Text(args.value);
                }
              );
              break;
            }
            case 'insert': { 
              this._modelDB.amDoc = Automerge.change(
                this._modelDB.amDoc,
                `string insert ${this._path} ${args.start} ${args.value}`,
                doc => {
                  (doc[this._path].value as Text).insertAt!(args.start, ...args.value);
                }
              );
              break;
            }
            case 'remove': {
              this._modelDB.amDoc = Automerge.change(
                this._modelDB.amDoc,
                `string remove ${this._path} ${args.start} ${args.end}`,
                doc => {
                  (doc[this._path].value as Text).deleteAt!(args.start, args.end - args.start);
                }
              );
              break;
            } 
          }
        });
      });
    }

  private _onMimeTypeChanged(
    value: IObservableValue,
    args: ObservableValue.IChangedArgs
  ): void {
    // TODO(ECH) Implement this.
  }

  private _onSelectionsChanged(
    value: IObservableMap<any>,
    args: IObservableMap.IChangedArgs<any>
  ): void {
    waitForModelInit(this._modelDB, () => {
      this._lock(() => {
        switch(args.type) {
          case 'add': {
            this._modelDB.amDoc = Automerge.change(
              this._modelDB.amDoc,
              `selections add ${this._path} ${args.key}`,
              doc => {
                doc[this._path].selections[args.key] = args.newValue;
              }
            );
            break;
          }
          case 'remove': { 
            this._modelDB.amDoc = Automerge.change(
              this._modelDB.amDoc,
              `selections delete ${this._path} ${args.key}`,
              doc => {
                delete doc[this._path].selections[args.key] ;
              }
            );
            break;
          }
          case 'change': {
            this._modelDB.amDoc = Automerge.change(
              this._modelDB.amDoc,
              `selections change ${this._path} ${args.key}`,
              doc => {
                doc[this._path].selections[args.key] = args.newValue;
              }
            );
            break;
          } 
        }
      });
    });
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
    if (this._modelDB.amDoc[this._path]) {
      this._modelDB.amDoc[this._path].clear();
    }
  }

  private _path: string;
  private _modelDB: AutomergeModelDB;
  private _observable: Observable;
  private _lock: any;
  private _value: IObservableString;
  private _mimeType: IObservableValue;
  private _selections: IObservableJSON;
  private _changed = new Signal<this, IObservableCodeEditor.IChangedArgs>(this);
  private _isDisposed = false;
}

/**
 * The namespace for `ObservableCodeEditor` class statics.
 */
export namespace AutomergeCodeEditor {
  /**
   * The options used to initialize an observable map.
   */
  export interface IOptions {
    /**
     * An optional initial set of values.
     */
    values?: { [key: string]: any };
  }
}
