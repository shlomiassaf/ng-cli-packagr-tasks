import { ParsedConfiguration } from '@angular/compiler-cli';
import { experimental, logging, Path } from '@angular-devkit/core';
import { BuilderContext } from '@angular-devkit/architect';
import { NgPackagrBuilderOptions } from '@angular-devkit/build-angular';
import { BuildGraph } from 'ng-packagr/lib/graph/build-graph';
import { EntryPointNode } from 'ng-packagr/lib/ng-package/nodes';
import { HookRegistry } from './hook-registry';

/**
 * A context for hooks running at the initialization phase, when all entry points are discovered and all initial values are loaded.
 */
export interface TaskContext<T = any[], TData extends NgPackagrBuilderTaskSchema = NgPackagrBuilderTaskSchema> {

  /**
   * A tuple with injected objects passed to the factory of the transformer.
   */
  factoryInjections: T;

  /**
   * The main build graph
   */
  graph: BuildGraph;

  context(): NgPackagerHooksContext;

  taskArgs(key: string): string | undefined;
}

/**
 * A context for hook handlers running at the processing phase, where each entry point is being processed in a sequence, one after the other.
 */
export interface EntryPointTaskContext<T = any[], TData extends NgPackagrBuilderTaskSchema = NgPackagrBuilderTaskSchema> extends TaskContext<T, TData> {
  /**
   * The current entry point processed.
   */
  epNode: EntryPointNode;
}

export type HookHandler<T> = (taskContext: T) => (BuildGraph | void | Promise<BuildGraph> | Promise<void>);

export type TaskOrTasksLike<T> = HookHandler<T> | Array<HookHandler<T>>;

export interface TaskPhases<T = EntryPointTaskContext> {
  before?: TaskOrTasksLike<T>;
  replace?: TaskOrTasksLike<T>;
  after?: TaskOrTasksLike<T>;
}

export interface NgPackagerHooks {
  initTsConfig?: TaskPhases<TaskContext<[ParsedConfiguration]>>;
  analyseSources?: TaskPhases<TaskContext>;
  entryPoint?: TaskPhases;
  compileNgc?: TaskPhases;
  writeBundles?: TaskPhases;
  writePackage?: TaskPhases;
}

export interface NgPackagerHooksContext {
  logger: logging.LoggerApi,
  root: Path;
  projectRoot: Path;
  sourceRoot: Path;
  builderContext: BuilderContext;
  options: NgPackagrBuilderOptions;
  workspace: experimental.workspace.Workspace;
}

export type NgPackagerHooksModule
  = NgPackagerHooks
  | ((ctx: NgPackagerHooksContext, registry: HookRegistry) => void | Promise<void>);

export interface NgPackagrBuilderTaskSchema { }

export interface NgPackagrBuilderTaskOptions<T extends NgPackagrBuilderTaskSchema = NgPackagrBuilderTaskSchema> {
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
    config?: string;

    /**
     * An arbitrary object with data passed for transformers.
     * Use this to passed configuration to transformers, for example a copy file instruction.
     */
    data?: T;    
    /**
     * Valid when the module in 'transformConfig' is a TS module. The full path for the TypeScript configuration file , relative to the current workspace, used to load the module in transformConfig.
     */
    tsConfig?: string;
}

export type NgPackagrBuilderOptionsWithTasks<T extends NgPackagrBuilderTaskSchema = NgPackagrBuilderTaskSchema>
  = NgPackagrBuilderOptions & { tasks: NgPackagrBuilderTaskOptions<T> };

  declare module '@angular-devkit/build-angular/src/ng-packagr/schema.d' {
    interface Schema {
    tasks?: NgPackagrBuilderTaskOptions;
    tasksArgs?: string;
  }
}

/** @internal */
export interface NormalizedTaskPhases<T = EntryPointTaskContext> {
  before?: Array<HookHandler<T>>;
  replace?: Array<HookHandler<T>>;
  after?: Array<HookHandler<T>>;
}

/** @internal */
export interface NormalizedNgPackagerHooks {
  initTsConfig?: NormalizedTaskPhases<TaskContext<[ParsedConfiguration]>>;
  analyseSources?: NormalizedTaskPhases<TaskContext>;
  entryPoint?: NormalizedTaskPhases;
  compileNgc?: NormalizedTaskPhases;
  writeBundles?: NormalizedTaskPhases;
  writePackage?: NormalizedTaskPhases;
}