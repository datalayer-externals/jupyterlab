import * as React from 'react';
import { JSONObject } from '@lumino/coreutils';
import { Widget, Panel } from '@lumino/widgets';
import { IOutputAreaModel } from './model';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { OutputArea, IStdin } from './widget';
import * as nbformat from '@jupyterlab/nbformat';

/**
 * The class name added to the direction children of OutputArea
 */
const OUTPUT_AREA_ITEM_CLASS = 'jp-OutputArea-child';

/**
 * The class name added to actual outputs
 */
const OUTPUT_AREA_OUTPUT_CLASS = 'jp-OutputArea-output';

/**
 * The class name added to prompt children of OutputArea.
 */
const OUTPUT_AREA_PROMPT_CLASS = 'jp-OutputArea-prompt';

/**
 * The class name added stdin items of OutputArea
 */
const OUTPUT_AREA_STDIN_ITEM_CLASS = 'jp-OutputArea-stdin-item';

type FUTURE = Kernel.IShellFuture<
  KernelMessage.IExecuteRequestMsg,
  KernelMessage.IExecuteReplyMsg
>;
type STATE = {
  stdin: [Widget, IStdin] | null;
  output: Array<{ displayID: string; widget: Widget }>;
};
type ACTION =
  | {
      name: 'future.onStdin';
      msg: KernelMessage.IStdinMessage<KernelMessage.StdinMessageType>;
    }
  | {
      name: 'future.onIOPub';
      msg: KernelMessage.IIOPubMessage<KernelMessage.IOPubMessageType>;
    }
  | {
      name: 'future.onReply';
      msg: KernelMessage.IExecuteReplyMsg;
    }
  | { name: 'model.clear' }
  | { name: 'stdin.value'; value: string };

const DEFAULT_STATE: STATE = { stdin: null, output: [] };

function makeReducer({
  future,
  contentFactory,
  model
}: {
  future: FUTURE;
  contentFactory: OutputArea.ContentFactory;
  model: IOutputAreaModel;
}): (state: STATE, action: ACTION) => STATE {
  return (state, action) => {
    switch (action.name) {
      case 'future.onIOPub':
        const msg: KernelMessage.IIOPubMessage = action.msg;
        let output: nbformat.IOutput;
        let transient = ((msg.content as any).transient || {}) as JSONObject;
        let displayId = transient['display_id'] as string;
        let targets: number[] | undefined;

        console.log('--- msg', msg);

        switch (msg.header.msg_type) {
          case 'execute_result':
            return {
              output: state.output.concat((msg.content as any).text),
              stdin: state.stdin
            };
          case 'display_data':
            return {
              output: state.output.concat((msg.content as any).text),
              stdin: state.stdin
            };
          case 'stream':
            return {
              output: state.output.concat((msg.content as any).text),
              stdin: state.stdin
            };
          case 'error':
            output = {
              ...msg.content,
              output_type: msg.header.msg_type
            };
            model.add(output);
            break;
          case 'clear_output':
            let wait = (msg as KernelMessage.IClearOutputMsg).content.wait;
            model.clear(wait);
            break;
          case 'update_display_data':
            output = { ...msg.content, output_type: 'display_data' };
            targets = this._displayIdMap.get(displayId);
            if (targets) {
              for (let index of targets) {
                model.set(index, output);
              }
            }
            break;
          default:
            break;
        }
        return state;
      case 'future.onStdin':
        const { msg: stdinMsg } = action;
        if (KernelMessage.isInputRequestMsg(stdinMsg)) {
          return {
            ...state,
            stdin: makeStdin({ msg: stdinMsg, contentFactory, future })
          };
        }
        return state;
      case 'stdin.value':
        const { value } = action;
        model.add({
          output_type: 'stream',
          name: 'stdin',
          text: value + '\n'
        });
        const { stdin, ...restState } = state;
        if (!stdin) {
          throw new Error(
            'If we have a stdin value, we should have had a stdin widget'
          );
        }
        stdin[0].dispose();
        return {
          ...restState,
          stdin: null
        };
      case 'future.onReply':
        return {
          ...state,
          stdin: null
        };
      case 'model.clear':
        model.clear();
        return {
          ...state,
          stdin: null
        };
      //      default:
      //        throw new Error(`Unknown action ${action.name}`);
    }
  };
}

function makeStdin({
  msg,
  contentFactory,
  future
}: {
  msg: KernelMessage.IInputRequestMsg;
  contentFactory: OutputArea.ContentFactory;
  future: FUTURE;
}): [Widget, IStdin] {
  const panel = new Panel();
  panel.addClass(OUTPUT_AREA_ITEM_CLASS);
  panel.addClass(OUTPUT_AREA_STDIN_ITEM_CLASS);

  const prompt = contentFactory.createOutputPrompt();
  prompt.addClass(OUTPUT_AREA_PROMPT_CLASS);
  panel.addWidget(prompt);

  const input = contentFactory.createStdin({
    prompt: msg.content.prompt,
    password: msg.content.password,
    future
  });
  input.addClass(OUTPUT_AREA_OUTPUT_CLASS);
  panel.addWidget(input);

  return [panel, input];
}

/**
 * Create an output area component based on the model.
 *
 * Will call `setWidgets` with a list of the lumino widgets displayed in this widget every time they change.
 */
export default function OutputAreaComponent({
  model,
  future,
  contentFactory,
  setWidgets
}: {
  model: IOutputAreaModel;
  setWidgets: (widgets: Widget[]) => void;
  contentFactory: OutputArea.ContentFactory;
  future: FUTURE;
}) {
  const [state, setState] = React.useReducer(
    React.useCallback(makeReducer({ future, contentFactory, model }), [
      future,
      contentFactory,
      model
    ]),
    DEFAULT_STATE
  );

  React.useEffect(() => {
    setState({ name: 'model.clear' });
    if (future) {
      future.onIOPub = msg => setState({ name: 'future.onIOPub', msg });
      future.onReply = msg => setState({ name: 'future.onReply', msg });
      future.onStdin = msg => setState({ name: 'future.onStdin', msg });
      return () => future.dispose();
    }
  }, [setState, future]);

  React.useEffect(() => {
    if (state.stdin) {
      state.stdin[1].value.then(value =>
        setState({ name: 'stdin.value', value })
      );
    }
  }, [state.stdin]);

  // Either we have a current input request we are dealing with
  // or we dont
  // Either
  // Keep a list of widgets and display ids

  // Update on model change

  // mapping

  return <>{state.output}</>;
}
