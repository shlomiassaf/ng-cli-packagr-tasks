import { pipe } from 'rxjs';

import { TransformProvider } from 'ng-packagr/lib/brocc/transform.di';
import { transformFromPromise, Transform } from 'ng-packagr/lib/brocc/transform';
import { isEntryPointInProgress, EntryPointNode } from 'ng-packagr/lib/ng-v5/nodes';

import { ANALYSE_SOURCES_TRANSFORM } from 'ng-packagr/lib/ng-v5/init/analyse-sources.di';
import { ENTRY_POINT_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point.di';
import { COMPILE_NGC_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point/ts/compile-ngc.di';
import { WRITE_BUNDLES_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point/write-bundles.di';
import { WRITE_PACKAGE_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point/write-package.di';

import { TransformerHook, HookHandler, EntryPointHookHandler, NgPackagerTransformerHooks } from './hooks';

const HOOK_HANDLERS: Array<keyof NgPackagerTransformerHooks> = ['analyseSources'];
const TRANSFORM_PROVIDER_MAP: Record<keyof NgPackagerTransformerHooks, TransformProvider> = {
  analyseSources: ANALYSE_SOURCES_TRANSFORM,
  entryPoint: ENTRY_POINT_TRANSFORM,
  compileNgc: COMPILE_NGC_TRANSFORM,
  writeBundles: WRITE_BUNDLES_TRANSFORM,
  writePackage: WRITE_PACKAGE_TRANSFORM
}

export function createHookProviders(hooksConfig: NgPackagerTransformerHooks): TransformProvider[] {
  const providers: TransformProvider[] = [];
  const hookNames: Array<keyof NgPackagerTransformerHooks> = Object.keys(TRANSFORM_PROVIDER_MAP) as any;

  for (const key of hookNames) {
    if (hooksConfig[key]) {
      providers.push(createHookProvider(key, hooksConfig[key]));
    }
  }

  return providers;
}

export function createHookProvider(sourceHookName: keyof NgPackagerTransformerHooks, hookConfig: TransformerHook<HookHandler | EntryPointHookHandler>): TransformProvider {
  const originalProvider = TRANSFORM_PROVIDER_MAP[sourceHookName];

  if (!originalProvider) {
    throw new Error(`Invalid source hook name, ${sourceHookName} is not a recognized hook`);
  }

  const clonedProvider = { ...originalProvider };

  clonedProvider.useFactory = (...args: any[]) => {
    const { before, replace, after } = hookConfig;
    const runners: Transform[] = [];

    const isEntryPointHandler = HOOK_HANDLERS.indexOf(sourceHookName) === -1;
    if (before) {
      runners.push(createHookTransform(before, isEntryPointHandler));
    }

    runners.push(replace ? createHookTransform(replace, isEntryPointHandler) : originalProvider.useFactory(...args));

    if (after) {
      runners.push(createHookTransform(after, isEntryPointHandler));
    }

    return pipe(...runners as [Transform, Transform, Transform]);
  };

  return clonedProvider;
}

function createHookTransform(handler: HookHandler | EntryPointHookHandler, isEntryPointHandler?: boolean): Transform {
  return transformFromPromise( async graph => {
    if (isEntryPointHandler) {
      const fn: EntryPointHookHandler = handler as any;
      const entryPointNode = graph.find(isEntryPointInProgress()) as EntryPointNode;
      return Promise.resolve(fn(entryPointNode, graph)).then( g => g || graph );
    } else {
      const fn: HookHandler = handler as any;
      return Promise.resolve(fn(graph)).then( g => g || graph );
    }
  });
}
