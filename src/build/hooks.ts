import { BuildGraph } from 'ng-packagr/lib/brocc/build-graph';
import { EntryPointNode } from 'ng-packagr/lib/ng-v5/nodes';
import { logging } from '@angular-devkit/core';

/**
 * A hook handler that runs at the initialization phase, when all entry points are discovered and all initial values are loaded.
 */
export type HookHandler = (graph: BuildGraph) => BuildGraph | undefined | Promise<BuildGraph | undefined>;
/**
 * A hook handler that runs at the processing phase, where each entry point is being processed in a sequence, one after the other.
 * The entry point currently processed is passed in the first parameter.
 */
export type EntryPointHookHandler = (currentEntryPoint: EntryPointNode, graph: BuildGraph) => BuildGraph | undefined | Promise<BuildGraph | undefined>;

export interface TransformerHook<T = EntryPointHookHandler> {
  before?: T;
  replace?: T;
  after?: T;
}

export interface NgPackagerTransformerHooks {
  analyseSources?: TransformerHook<HookHandler>;
  entryPoint?: TransformerHook;
  compileNgc?: TransformerHook;
  writeBundles?: TransformerHook;
  writePackage?: TransformerHook;
}

export interface NgPackagerTransformerHooksContext {
  logger: logging.Logger,
  root: string;
}

export type NgPackagerTransformerHooksModule
  = NgPackagerTransformerHooks
  | ((ctx: NgPackagerTransformerHooksContext) => NgPackagerTransformerHooks | Promise<NgPackagerTransformerHooks>);

declare module '@angular-devkit/build-ng-packagr/src/build/index.d' {
  interface NgPackagrBuilderOptions {
    /**
     * A path to a module exporting the transform configuration.
     *
     * The module must implement `NgPackagerTransformerHooksModule` which means it must export (default) one of:
     *
     * - Direct transformer hook configuration (`NgPackagerTransformerHooks`)
     * - A function that returns a transformer hook configuration or a Promise. `() => NgPackagerTransformerHooks | Promise<NgPackagerTransformerHooks>`
     *
     * If the module is a TS file and there isn't any handler for the .ts extension, will try to require ts-node/register
     *
     * Note that this module is executed in `node` runtime, if it's a TS module make sure the ts compiler configuration is appropriate.
     */
    transformConfig?: string;
    /**
     * Valid when the module in 'transformConfig' is a TS module. The full path for the TypeScript configuration file , relative to the current workspace, used to load the module in transformConfig.
     */
    transformTsConfig?: string;
  }
}
