// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module observables-extension
 */

import {
  ILabStatus,
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ISessionContextDialogs,
  ICommandPalette,
  sessionContextDialogs,
  WidgetTracker
} from '@jupyterlab/apputils';

import { IEditorServices } from '@jupyterlab/codeeditor';

import { ConsolePanel, IConsoleTracker } from '@jupyterlab/console';

import { PageConfig, URLExt } from '@jupyterlab/coreutils';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { ILauncher } from '@jupyterlab/launcher';

import {
  IMainMenu,
} from '@jupyterlab/mainmenu';

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { ITranslator } from '@jupyterlab/translation';

import { DisposableSet } from '@lumino/disposable';

/**
 * The console widget tracker provider.
 */
const tracker: JupyterFrontEndPlugin<IConsoleTracker> = {
  id: '@jupyterlab/observables-extension:tracker',
  provides: IConsoleTracker,
  requires: [
    ConsolePanel.IContentFactory,
    IEditorServices,
    IRenderMimeRegistry,
    ISettingRegistry,
    ITranslator
  ],
  optional: [
    ILayoutRestorer,
    IFileBrowserFactory,
    IMainMenu,
    ICommandPalette,
    ILauncher,
    ILabStatus,
    ISessionContextDialogs
  ],
  activate: activateConsole,
  autoStart: true
};

/**
 * The console widget content factory.
 */
const factory: JupyterFrontEndPlugin<ConsolePanel.IContentFactory> = {
  id: '@jupyterlab/observables-extension:factory',
  provides: ConsolePanel.IContentFactory,
  requires: [IEditorServices],
  autoStart: true,
  activate: (app: JupyterFrontEnd, editorServices: IEditorServices) => {
    const editorFactory = editorServices.factoryService.newInlineEditor;
    return new ConsolePanel.ContentFactory({ editorFactory });
  }
};

/**
 * Export the plugins as the default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [factory, tracker];

export default plugins;

/**
 * Activate the console extension.
 */
async function activateConsole(
  app: JupyterFrontEnd,
  contentFactory: ConsolePanel.IContentFactory,
  editorServices: IEditorServices,
  rendermime: IRenderMimeRegistry,
  settingRegistry: ISettingRegistry,
  translator: ITranslator,
  restorer: ILayoutRestorer | null,
  browserFactory: IFileBrowserFactory | null,
  mainMenu: IMainMenu | null,
  palette: ICommandPalette | null,
  launcher: ILauncher | null,
  status: ILabStatus | null,
  sessionDialogs: ISessionContextDialogs | null
): Promise<IConsoleTracker> {
  const manager = app.serviceManager;
  sessionDialogs = sessionDialogs ?? sessionContextDialogs;

  // Create a widget tracker for all console panels.
  const tracker = new WidgetTracker<ConsolePanel>({
    namespace: 'console'
  });

  // Add a launcher item if the launcher is available.
  if (launcher) {
    void manager.ready.then(() => {
      let disposables: DisposableSet | null = null;
      const onSpecsChanged = () => {
        if (disposables) {
          disposables.dispose();
          disposables = null;
        }
        const specs = manager.kernelspecs.specs;
        if (!specs) {
          return;
        }
        disposables = new DisposableSet();
        const baseUrl = PageConfig.getBaseUrl();
        for (const name in specs.kernelspecs) {
          const spec = specs.kernelspecs[name]!;
          let kernelIconUrl = spec.resources['logo-64x64'];
          if (kernelIconUrl) {
            const index = kernelIconUrl.indexOf('kernelspecs');
            kernelIconUrl = URLExt.join(baseUrl, kernelIconUrl.slice(index));
          }
        }
      };
      onSpecsChanged();
      manager.kernelspecs.specsChanged.connect(onSpecsChanged);
    });
  }

  const pluginId = '@jupyterlab/observables-extension:tracker';
  let realtimeProtocol: string;
  async function updateSettings() {
    realtimeProtocol = (await settingRegistry.get(pluginId, 'realtimeProtocol'))
      .composite as string;
//    tracker.forEach(widget => {
//      widget.console.node.dataset.jpInteractionMode = interactionMode;
//    });
  console.log('---- realtimeProtocol', realtimeProtocol);
  }
  settingRegistry.pluginChanged.connect((sender, plugin) => {
    if (plugin === pluginId) {
      void updateSettings(); 
    }
  });
  await updateSettings();

  return tracker;
}
