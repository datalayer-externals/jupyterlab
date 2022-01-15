/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { PanelWithToolbar } from '@jupyterlab/ui-components';
import { IDebugger } from '../../tokens';
import { KernelSourcesBody } from './body';

/**
 * A Panel that shows a preview of the source code while debugging.
 */
export class KernelSources extends PanelWithToolbar {
  /**
   * Instantiate a new Sources preview Panel.
   *
   * @param options The Sources instantiation options.
   */
  constructor(options: KernelSources.IOptions) {
    super();
    const { model, service } = options;
    const trans = (options.translator ?? nullTranslator).load('jupyterlab');
    this.title.label = trans.__('Kernel Sources');

    this.toolbar.addClass('jp-DebuggerKernelSources-header');
    const body = new KernelSourcesBody({
      service,
      model
    });
    this.addClass('jp-DebuggerKernelSources-header');
    this.addWidget(body);
    this.addClass('jp-DebuggerKenelSources');
  }
}

/**
 * A namespace for `Sources` statics.
 */
export namespace KernelSources {
  /**
   * The options used to create a Sources.
   */
  export interface IOptions {
    /**
     * The debugger service.
     */
    service: IDebugger;

    /**
     * The model for the sources.
     */
    model: IDebugger.Model.IKernelSources;

    /**
     * The application language translator
     */
    translator?: ITranslator;
  }
}