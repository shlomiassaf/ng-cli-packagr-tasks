import * as qs from 'querystring';
import { pipe } from 'rxjs';

import { BuildGraph } from 'ng-packagr/lib/brocc/build-graph';
import { TransformProvider } from 'ng-packagr/lib/brocc/transform.di';
import { transformFromPromise, Transform } from 'ng-packagr/lib/brocc/transform';
import { isEntryPointInProgress, EntryPointNode } from 'ng-packagr/lib/ng-v5/nodes';

import {
  HookHandler,
  TaskContext,
  EntryPointTaskContext,
  NormalizedNgPackagerHooks,
  NgPackagerHooksContext,
  NgPackagrBuilderTaskSchema
} from './hooks';
import { TRANSFORM_PROVIDER_MAP } from './utils';

const HOOK_HANDLERS: Array<keyof NormalizedNgPackagerHooks> = ['initTsConfig', 'analyseSources'];

class _TaskContext<T = any[], TData extends NgPackagrBuilderTaskSchema = NgPackagrBuilderTaskSchema> implements EntryPointTaskContext<T, TData> {
  readonly factoryInjections: T;

  /**
   * The main build graph
   */
  graph: BuildGraph;

  epNode: EntryPointNode;

  private parsedTaskArgs: any;

  constructor(private readonly _context: NgPackagerHooksContext<TData>, factoryInjections: T, graph?: BuildGraph) {
    this.factoryInjections = factoryInjections;
    if (graph) {
      this.graph = graph;
    }
  }

  context<Z extends NgPackagrBuilderTaskSchema = TData>(): NgPackagerHooksContext<Z> {
    return this._context as any;
  }

  taskArgs(key: string): string | undefined {
    if (!this.parsedTaskArgs) {
      const { tasksArgs } = this.context().builderConfig.options;
      this.parsedTaskArgs = qs.parse(tasksArgs || '');
    }
    return this.parsedTaskArgs[key];
  }
}

export function createHookProviders(hooksConfig: NormalizedNgPackagerHooks,
                                    globalTasksContext: NgPackagerHooksContext): TransformProvider[] {
  const providers: TransformProvider[] = [];
  const hookNames: Array<keyof NormalizedNgPackagerHooks> = Object.keys(TRANSFORM_PROVIDER_MAP) as any;

  for (const key of hookNames) {
    if (hooksConfig[key]) {
      providers.push(createHookProvider(key, hooksConfig[key], globalTasksContext));
    }
  }

  return providers;
}

export function createHookProvider<T extends keyof NormalizedNgPackagerHooks>(sourceHookName: T,
                                                                              hookConfig: NormalizedNgPackagerHooks[T],
                                                                              globalTasksContext: NgPackagerHooksContext): TransformProvider {
  const originalProvider = TRANSFORM_PROVIDER_MAP[sourceHookName];

  if (!originalProvider) {
    throw new Error(`Invalid source hook name, ${sourceHookName} is not a recognized hook`);
  }

  const clonedProvider = { ...originalProvider };

  clonedProvider.useFactory = (...args: any[]) => {
    const { before, replace, after } = hookConfig;
    const isEntryPointHandler = HOOK_HANDLERS.indexOf(sourceHookName) === -1;

    const taskContextFactory: (g: BuildGraph) => TaskContext = graph => {
      const taskContext = new _TaskContext(globalTasksContext, args, graph);
      if (isEntryPointHandler) {
        taskContext.epNode = graph.find(isEntryPointInProgress()) as EntryPointNode;
      }
      return taskContext;
    }

    const runners: Transform[] = [
     ...createHookTransform(before || [], taskContextFactory),
     ...createHookTransform(replace || [], taskContextFactory),
     !replace && originalProvider.useFactory(...args),
      ...createHookTransform(after || [], taskContextFactory),
    ].filter( t => !!t );

    return pipe(...runners as [Transform, Transform?, Transform?]);
  };

  return clonedProvider;
}

function createHookTransform(tasksLike: Array<HookHandler<any>>,
                             taskContextFactory: (g: BuildGraph) => TaskContext): Transform[] {
  return tasksLike.map( handler => {
    return transformFromPromise( async graph => {
      return Promise.resolve<BuildGraph | void>(handler(taskContextFactory(graph))).then( g => g || graph );
    });
  });
}

