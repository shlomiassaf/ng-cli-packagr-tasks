import { ParsedConfiguration } from '@angular/compiler-cli';
import { BuildGraph } from 'ng-packagr/lib/brocc/build-graph';
import { EntryPointNode } from 'ng-packagr/lib/ng-v5/nodes';
import { logging } from '@angular-devkit/core';

/**
 * A context for hooks running at the initialization phase, when all entry points are discovered and all initial values are loaded.
 */
export interface TaskContext<T = any[], TDate = any> {
  /**
   * An arbitrary object passed from the CLI configuration in `angular.json`
   */
  transformData?: TDate;

  /**
   * A tuple with injected objects passed to the factory of the transformer.
   */
  factoryInjections: T;

  /**
   * The main build graph
   */
  graph: BuildGraph;
}

/**
 * A context for hook handlers running at the processing phase, where each entry point is being processed in a sequence, one after the other.
 */
export interface EntryPointTaskContext<T = any[], TDate = any> extends TaskContext<T> {
  /**
   * The current entry point processed.
   */
  epNode: EntryPointNode;
}

export type HookHandler<T> = (taskContext: T) => (BuildGraph | void | Promise<BuildGraph> | Promise<void>);

export interface TransformerHook<T = EntryPointTaskContext> {
  before?: HookHandler<T>;
  replace?: HookHandler<T>;
  after?: HookHandler<T>;
}

export interface NgPackagerTransformerHooks {
  initTsConfig?: TransformerHook<TaskContext<[ParsedConfiguration]>>;
  analyseSources?: TransformerHook<TaskContext>;
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
     * An arbitrary object with data passed for transformers.
     * Use this to passed configuration to transformers, for example a copy file instruction.
     */
    transformData?: any;    
    /**
     * Valid when the module in 'transformConfig' is a TS module. The full path for the TypeScript configuration file , relative to the current workspace, used to load the module in transformConfig.
     */
    transformTsConfig?: string;
  }
}
