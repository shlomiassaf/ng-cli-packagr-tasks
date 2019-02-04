import { switchMap, map } from 'rxjs/operators';

import { normalize, virtualFs, JsonParseMode, parseJson, JsonObject } from '@angular-devkit/core';
import { BuilderContext } from '@angular-devkit/architect';
import { TransformProvider } from 'ng-packagr/lib/brocc/transform.di';
import { INIT_TS_CONFIG_TRANSFORM } from 'ng-packagr/lib/ng-v5/init/init-tsconfig.di';
import { ANALYSE_SOURCES_TRANSFORM } from 'ng-packagr/lib/ng-v5/init/analyse-sources.di';
import { ENTRY_POINT_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point.di';
import { COMPILE_NGC_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point/ts/compile-ngc.di';
import { WRITE_BUNDLES_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point/write-bundles.di';
import { WRITE_PACKAGE_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point/write-package.di';

import {
  HookHandler,
  TypedTask,
  NgPackagerHooks,
  NgPackagrBuilderTaskOptions,
  NgPackagrBuilderTaskSchema,
  TaskPhases,
  NormalizedNgPackagerHooks
} from './hooks';

export const TRANSFORM_PROVIDER_MAP: Record<keyof NgPackagerHooks, TransformProvider> = {
  initTsConfig: INIT_TS_CONFIG_TRANSFORM,
  analyseSources: ANALYSE_SOURCES_TRANSFORM,
  entryPoint: ENTRY_POINT_TRANSFORM,
  compileNgc: COMPILE_NGC_TRANSFORM,
  writeBundles: WRITE_BUNDLES_TRANSFORM,
  writePackage: WRITE_PACKAGE_TRANSFORM
}

export const HOOK_PHASES = ['before', 'replace', 'after'] as Array<keyof TaskPhases>;

export function isTypedTask<T>(hook: TypedTask<T> | HookHandler<T>): hook is TypedTask<T> {
  return hook && typeof hook !=='function';
}

export function getHandler<T>(hook: TypedTask<T> | HookHandler<T>): HookHandler<T> {
  return isTypedTask(hook) ? hook.handler : hook;
}

export function normalizeHooks(hooks: NgPackagerHooks): NormalizedNgPackagerHooks {
  const hookNames: Array<keyof NgPackagerHooks> = Object.keys(TRANSFORM_PROVIDER_MAP) as any;

  for (const key of hookNames) {
    if (hooks[key]) {
      for (const phase of HOOK_PHASES) {
        const taskOrTasksLike = hooks[key][phase];
        if (taskOrTasksLike) {
          hooks[key][phase] = Array.isArray(taskOrTasksLike)
            ? taskOrTasksLike
            : [ taskOrTasksLike ]
          ;
        }
      }
    }
  }

  return hooks as NormalizedNgPackagerHooks;
}

export function getTaskDataInput<T>(task: TypedTask, tasks: NgPackagrBuilderTaskOptions<NgPackagrBuilderTaskSchema>) {
  const data = tasks.data || {};
  return { [task.selector]: data[task.selector] };
}

export async function validateTypedTasks(hooks: NormalizedNgPackagerHooks,
                                         context: BuilderContext,
                                         tasks: NgPackagrBuilderTaskOptions<NgPackagrBuilderTaskSchema>) {

  const keys = Object.keys(hooks) as Array<keyof NormalizedNgPackagerHooks>;
  const allHooksPromises: Promise<any>[] = [];

  for (const key of keys) {
    const metadata = HOOK_PHASES
      .reduce( (arr, k) => arr.concat(hooks[key][k] || []), [])
      .filter(isTypedTask)
    
    const promises = metadata.map( taskMeta => {
      return context.workspace.host.read(normalize(taskMeta.schema))
        .pipe(
          map(buffer => virtualFs.fileBufferToString(buffer)),
          map(str => parseJson(str, JsonParseMode.Loose) as {} as JsonObject),
          switchMap( jsonSchema => {
            return context.workspace.validateAgainstSchema<any>(getTaskDataInput(taskMeta, tasks), jsonSchema);
          })
        )
        .toPromise();
    });

    allHooksPromises.push(...promises);
  }

  await Promise.all(allHooksPromises);
  return hooks;
}