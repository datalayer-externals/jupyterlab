// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { URLExt } from '@jupyterlab/coreutils';

import { PromiseDelegate } from '@lumino/coreutils';

import { Datastore, IServerAdapter } from '@lumino/datastore';

import { IMessageHandler, Message, MessageLoop } from '@lumino/messaging';

import { ServerConnection, WSConnection } from '@jupyterlab/services';

import { Collaboration } from './wsmessages';

type TransactionHandler = (transaction: Datastore.Transaction) => void;

/**
 * The url for the datastore service.
 */
const DATASTORE_SERVICE_URL = 'lab/api/datastore';

/**
 * The default treshold for idle time, in seconds.
 */
const DEFAULT_IDLE_TIME = 3;

/**
 * A class that manages exchange of transactions with the collaboration server.
 */
export class CollaborationClient
  extends WSConnection<Collaboration.Message, Collaboration.Message>
  implements IServerAdapter {
  /**
   * Create a new collaboration client connection.
   */
  constructor(options: CollaborationClient.IOptions = {}) {
    super();
    this.collaborationId = options.collaborationId;
    this._idleTreshold = 1000 * (options.idleTreshold || DEFAULT_IDLE_TIME);
    this.serverSettings =
      options.serverSettings || ServerConnection.makeSettings();
    this._createSocket();
  }

  /**
   * The permissions for the current use on the datastore session.
   */
  get permissions(): Promise<CollaborationClient.Permissions> {
    return Promise.resolve().then(async () => {
      await this.ready;
      const msg = Collaboration.createMessage('permissions-request', {});
      const reply = await this._requestMessageReply(msg);
      return reply.content;
    });
  }

  broadcast(transaction: Datastore.Transaction): void {
    this.broadcastTransactions([transaction]);
  }

  // Set by datastore when it's created.
  set onRemoteTransaction(onRemoteTransaction: TransactionHandler) {
    this._ws!.onmessage = evt => {
      const msg = JSON.parse(evt.data);
      console.log('--- onRemoteTransaction', msg);
      if (msg.content && msg.content.transactions) {
        const transactions = msg.content.transactions;
        console.log('--- onRemoteTransaction', transactions);
        transactions.map((t: any) => {
          onRemoteTransaction(t);
        });
      }
    };
  }

  onUndo!: ((transaction: Datastore.Transaction) => void) | null;
  onRedo!: ((transaction: Datastore.Transaction) => void) | null;
  undo(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  redo(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  processMessage(msg: Message) {
    console.log('--- processMessage', msg);
    if (msg.type === 'datastore-transaction') {
      // TODO(RTC)
      this.broadcastTransactions([
        ((msg as any) as CollaborationClient.RemoteTransactionMessage)
          .transaction
      ]);
      return;
    }

    /*

    else if (msg.type === 'datastore-transaction') {
      if (this._client) {
        this._client.broadcastTransactions([
          (msg as TransactionMessage).transaction
        ]);
      }
    } else if (msg.type === 'initial-state') {
      const state = (msg as CollaborationClient.InitialStateMessage).state;

      // Scenarios:
      // 1. Immediate (has localDS), and state is null: Clone local.
      // 2. Non-immediate, and state is null: Simple create of remote.
      // 3. Non-immediate, and state is non-null: Recreate remote from state.
      // 4. Immediate, and non-null state: Error!
      // 5. Has remote already: Treat as non-immediate (recovery)

      const immediate = this._localDS !== null && this._remoteDS === null;
      if (!immediate) {
        // 2. / 3.  ( 5.)
        // TODO(@echarles) broadcastHandler: this,
        this._remoteDS = Datastore.create({
          id: this._storeId!,
          schemas: this._schemas,
          adapter: (this._client as IServerAdapter) || null,
          restoreState: state || undefined
        });
        if (state !== null) {
          this._prepopulated = true;
        }
      } else if (state === null) {
        // 1.
        // TODO(@echarles) broadcastHandler: this,
        this._remoteDS = cloneDS(this._storeId!, this._localDS!, {
          adapter: (this._client as IServerAdapter) || null
        });
      } else {
        // 4.
        throw new Error(
          'Cannot replace the state of an immediate collaboration session!'
        );
      }

      this._datastoreChanged.emit({ datastore: this._remoteDS });

      if (this._localDS) {
        this._localDS.dispose();
        this._localDS = null;
      }
    } else if (msg.type === 'datastore-gc-chance') {
      MessageLoop.sendMessage(this._remoteDS || this._localDS!, msg);
    }

    */

    throw new Error(
      `CollaborationClient cannot process message type ${msg.type}`
    );
  }
  /**
   * Broadcast transactions to all datastores.
   *
   * @param transactions - The transactions to broadcast.
   * @returns An array of acknowledged transactionIds from the server.
   */
  broadcastTransactions(transactions: Datastore.Transaction[]): void {
    console.log('--- broadcastTransactions', transactions);
    // Brand outgoing transactions with our serial
    const branded = [];
    for (let t of transactions) {
      const b = { ...t, serial: this._ourSerial++ };
      branded.push(b);
      this._pendingTransactions[b.id] = b;
    }
    this._resetIdleTimer();
    const msg = Collaboration.createMessage('transaction-broadcast', {
      transactions: branded
    });
    this._requestMessageReply(msg).then(
      reply => {
        const { serials, transactionIds } = reply.content;
        for (let i = 0; i < serials.length; ++i) {
          const serial = serials[i];
          const id = transactionIds[i];
          delete this._pendingTransactions[id];
          if (serial !== this._serverSerial + 1) {
            // Out of order serials!
            // Something has gone wrong somewhere.
            // TODO: Trigger recovery?
            throw new Error(
              'Critical! Out of order transactions in datastore.'
            );
          }
          this._serverSerial = serial;
        }
        this._resetIdleTimer();
      },
      () => {
        // TODO: Resend transactions
      }
    );
  }

  /**
   * Request the complete history of the datastore.
   *
   * The transactions of the history will be sent to the set handler.
   */
  async replayHistory(checkpointId?: number): Promise<boolean> {
    const msg = Collaboration.createMessage('history-request', {
      checkpointId: checkpointId === undefined ? null : checkpointId
    });
    const response = await this._requestMessageReply(msg);
    console.log('--- history-reply', response);
    if (!response.content.transactions.length) {
      return false;
    }
    this._handleTransactions(response.content.transactions);
    return true;
  }

  /**
   * The server settings for the session.
   */
  readonly serverSettings: ServerConnection.ISettings;

  /**
   * The id of the collaboration.
   */
  readonly collaborationId: string | undefined;

  /**
   * The message handler of any data messages.
   */
  public handler: IMessageHandler | null;

  /**
   * Factory method for creating the web socket object.
   */
  protected wsFactory() {
    const settings = this.serverSettings;
    const token = this.serverSettings.token;
    const queryParams = [];

    let wsUrl;
    if (this.collaborationId) {
      wsUrl = URLExt.join(
        settings.wsUrl,
        DATASTORE_SERVICE_URL,
        this.collaborationId
      );
    } else {
      wsUrl = URLExt.join(settings.wsUrl, DATASTORE_SERVICE_URL);
    }

    if (token) {
      queryParams.push(`token=${encodeURIComponent(token)}`);
    }
    if (queryParams) {
      wsUrl = wsUrl + `?${queryParams.join('&')}`;
    }

    return new settings.WebSocket(wsUrl);
  }

  /**
   * Handler for deserialized websocket messages.
   */
  protected handleMessage(
    msg:
      | Collaboration.RawReply
      | Collaboration.TransactionBroadcast
      | Collaboration.StableStateNotice
  ): boolean {
    try {
      // TODO: Write a validator?
      // validate.validateMessage(msg);
    } catch (error) {
      console.error(`Invalid message: ${error.message}`);
      return false;
    }

    if (Collaboration.isReply(msg)) {
      let delegate = this._delegates && this._delegates.get(msg.parentId!);
      if (delegate) {
        if (msg.msgType === 'error-reply') {
          console.warn('Received datastore error from server', msg.content);
          delegate.reject(msg.content.reason);
        } else {
          delegate.resolve(msg);
        }
        return true;
      }
    }
    if (msg.msgType === 'transaction-broadcast') {
      this._handleTransactions(msg.content.transactions);
    } else if (msg.msgType === 'state-stable') {
      // TODO: Possibly signal a chance for garbage collection.
    } else {
      return false;
    }
    return true;
  }

  /**
   * Process transactions received over the websocket.
   */
  private _handleTransactions(
    transactions: ReadonlyArray<Collaboration.SerialTransaction>
  ) {
    if (!this.handler) {
      return;
    }
    for (let t of transactions) {
      if (t.serial !== this._serverSerial + 1) {
        // Out of order serials!
        // Something has gone wrong somewhere.
        // TODO: Trigger recovery?
        throw new Error('Critical! Out of order transactions in datastore.');
      }
      this._serverSerial = t.serial;
      // TODO(RTC)
      MessageLoop.sendMessage(
        this.handler,
        new CollaborationClient.RemoteTransactionMessage(t)
      );
    }
    this._resetIdleTimer();
  }

  /**
   * Send a message to the server and resolve the reply message.
   */
  private _requestMessageReply<T extends Collaboration.Request>(
    msg: T,
    timeout = 0
  ): Promise<Collaboration.IReplyMap[T['msgType']]> {
    const delegate = new PromiseDelegate<
      Collaboration.IReplyMap[T['msgType']]
    >();
    this._delegates.set(msg.msgId, delegate);

    // .finally(), delete from delegate map
    const promise = delegate.promise.then(
      reply => {
        this._delegates.delete(msg.msgId);
        return reply;
      },
      reason => {
        this._delegates.delete(msg.msgId);
        throw reason;
      }
    );

    if (timeout > 0) {
      setTimeout(() => {
        delegate.reject('Timed out waiting for reply');
      }, timeout);
    }

    this.sendMessage(msg);

    return promise;
  }

  /**
   * Callback called when idle after activity.
   */
  private _onIdle() {
    const msg = Collaboration.createMessage('serial-update', {
      serial: this._serverSerial
    });
    this.sendMessage(msg);
    this._idleTimer = null;
  }

  /**
   * Reset the idle timer.
   */
  private _resetIdleTimer() {
    if (this._idleTimer !== null) {
      clearTimeout(this._idleTimer);
    }
    this._idleTimer = setTimeout(this._onIdle.bind(this), this._idleTreshold);
  }

  private _delegates = new Map<string, PromiseDelegate<Collaboration.Reply>>();

  private _ourSerial = 0;
  private _serverSerial = 0;
  private _pendingTransactions: Collaboration.SerialTransactionMap = {};

  private _idleTreshold: number;
  private _idleTimer: number | null = null;
}

/**
 *
 */
export namespace CollaborationClient {
  export interface IOptions {
    /**
     * The id of the collaboration to connect to.
     */
    collaborationId?: string;

    /**
     * The server settings for the session.
     */
    serverSettings?: ServerConnection.ISettings;

    /**
     * How long to wait before the session is considered idle, in seconds.
     */
    idleTreshold?: number;
  }

  /**
   * A message class for `'remote-transactions'` messages.
   */
  export class RemoteTransactionMessage extends Message {
    /**
     * Construct a new remote transactions message.
     *
     * @param transaction - The transaction object
     */
    constructor(transaction: Datastore.Transaction) {
      super('remote-transactions');
      this.transaction = transaction;
    }

    /**
     * The patch object.
     */
    readonly transaction: Datastore.Transaction;
  }

  /**
   * A message class for initial state messages.
   */
  export class InitialStateMessage extends Message {
    /**
     * Construct a new initial state message.
     *
     * @param state - he serialized state
     */
    constructor(state: string | null) {
      super('initial-state');
      this.state = state;
    }

    /**
     * The serialized state.
     */
    readonly state: string | null;
  }

  /**
   * Datastore permissions object.
   */
  export type Permissions = {
    /**
     * Whether the current user can read from the datastore session.
     */
    read: boolean;

    /**
     * Whether the current user can write to the datastore session.
     */
    write: boolean;
  };
}
