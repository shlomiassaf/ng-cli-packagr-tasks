import { pipe } from 'rxjs';

import { BuildGraph } from 'ng-packagr/lib/brocc/build-graph';
import { TransformProvider } from 'ng-packagr/lib/brocc/transform.di';
import { transformFromPromise, Transform } from 'ng-packagr/lib/brocc/transform';
import { isEntryPointInProgress, EntryPointNode } from 'ng-packagr/lib/ng-v5/nodes';

import { INIT_TS_CONFIG_TRANSFORM } from 'ng-packagr/lib/ng-v5/init/init-tsconfig.di';
import { ANALYSE_SOURCES_TRANSFORM } from 'ng-packagr/lib/ng-v5/init/analyse-sources.di';
import { ENTRY_POINT_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point.di';
import { COMPILE_NGC_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point/ts/compile-ngc.di';
import { WRITE_BUNDLES_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point/write-bundles.di';
import { WRITE_PACKAGE_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point/write-package.di';

import { HookHandler, TaskContext, EntryPointTaskContext, NgPackagerTransformerHooks } from './hooks';

const HOOK_HANDLERS: Array<keyof NgPackagerTransformerHooks> = ['initTsConfig', 'analyseSources'];
const TRANSFORM_PROVIDER_MAP: Record<keyof NgPackagerTransformerHooks, TransformProvider> = {
  initTsConfig: INIT_TS_CONFIG_TRANSFORM,
  analyseSources: ANALYSE_SOURCES_TRANSFORM,
  entryPoint: ENTRY_POINT_TRANSFORM,
  compileNgc: COMPILE_NGC_TRANSFORM,
  writeBundles: WRITE_BUNDLES_TRANSFORM,
  writePackage: WRITE_PACKAGE_TRANSFORM
}

export function createHookProviders(hooksConfig: NgPackagerTransformerHooks, data?: any): TransformProvider[] {
  const providers: TransformProvider[] = [];
  const hookNames: Array<keyof NgPackagerTransformerHooks> = Object.keys(TRANSFORM_PROVIDER_MAP) as any;

  for (const key of hookNames) {
    if (hooksConfig[key]) {
      providers.push(createHookProvider(key, hooksConfig[key], data));
    }
  }

  return providers;
}


export function createHookProvider<T extends keyof NgPackagerTransformerHooks>(sourceHookName: T, hookConfig: NgPackagerTransformerHooks[T], data?: any): TransformProvider {
  const originalProvider = TRANSFORM_PROVIDER_MAP[sourceHookName];

  if (!originalProvider) {
    throw new Error(`Invalid source hook name, ${sourceHookName} is not a recognized hook`);
  }

  const clonedProvider = { ...originalProvider };

  clonedProvider.useFactory = (...args: any[]) => {
    const { before, replace, after } = hookConfig;
    const isEntryPointHandler = HOOK_HANDLERS.indexOf(sourceHookName) === -1;

    const baseTaskContext = { factoryInjections: args, transformData: data }
    const taskContextFactory: (g: BuildGraph) => TaskContext = graph => {
      const taskContext = { graph, ...baseTaskContext };
      if (isEntryPointHandler) {
        (taskContext as EntryPointTaskContext).epNode = graph.find(isEntryPointInProgress()) as EntryPointNode;
      }
      return taskContext;
    }

    const runners: Transform[] = [
      before && createHookTransform(before, taskContextFactory),
      replace ? createHookTransform(replace, taskContextFactory) : originalProvider.useFactory(...args),
      after && createHookTransform(after, taskContextFactory),
    ].filter( t => !!t );

    return pipe(...runners as [Transform, Transform?, Transform?]);
  };

  return clonedProvider;
}

function createHookTransform(handler: HookHandler<any>, taskContextFactory: (g: BuildGraph) => TaskContext): Transform {
  return transformFromPromise( async graph => {
    return Promise.resolve<BuildGraph | void>(handler(taskContextFactory(graph))).then( g => g || graph );
  });
}

