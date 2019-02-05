import { switchMap, map } from 'rxjs/operators';
import * as ts from 'typescript';

import { normalize, virtualFs, JsonParseMode, parseJson, JsonObject } from '@angular-devkit/core';
import { BuilderContext } from '@angular-devkit/architect';
import { TransformProvider } from 'ng-packagr/lib/brocc/transform.di';
import { EntryPointNode } from 'ng-packagr/lib/ng-v5/nodes';
import { INIT_TS_CONFIG_TRANSFORM } from 'ng-packagr/lib/ng-v5/init/init-tsconfig.di';
import { ANALYSE_SOURCES_TRANSFORM } from 'ng-packagr/lib/ng-v5/init/analyse-sources.di';
import { ENTRY_POINT_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point.di';
import { COMPILE_NGC_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point/ts/compile-ngc.di';
import { WRITE_BUNDLES_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point/write-bundles.di';
import { WRITE_PACKAGE_TRANSFORM } from 'ng-packagr/lib/ng-v5/entry-point/write-package.di';

import {
  NgPackagerHooks,
  NgPackagrBuilderTaskOptions,
  NgPackagrBuilderTaskSchema,
  TaskPhases,
  NormalizedNgPackagerHooks,
  NormalizedTaskPhases
} from './hooks';
import { JobMetadata } from './job';

export const TRANSFORM_PROVIDER_MAP: Record<keyof NgPackagerHooks, TransformProvider> = {
  initTsConfig: INIT_TS_CONFIG_TRANSFORM,
  analyseSources: ANALYSE_SOURCES_TRANSFORM,
  entryPoint: ENTRY_POINT_TRANSFORM,
  compileNgc: COMPILE_NGC_TRANSFORM,
  writeBundles: WRITE_BUNDLES_TRANSFORM,
  writePackage: WRITE_PACKAGE_TRANSFORM
}

export const HOOK_PHASES = ['before', 'replace', 'after'] as Array<keyof TaskPhases>;

export function normalizeHooks(hooks: NgPackagerHooks): NormalizedNgPackagerHooks {
  const hookNames: Array<keyof NgPackagerHooks> = Object.keys(TRANSFORM_PROVIDER_MAP) as any;

  for (const key of hookNames) {
    if (hooks[key]) {
      hooks[key] = normalizeTaskPhases(hooks[key]) as any;
    }
  }

  return hooks as NormalizedNgPackagerHooks;
}

export function normalizeTaskPhases(taskPhases: TaskPhases<any>): NormalizedTaskPhases {
  for (const phase of HOOK_PHASES) {
    const taskOrTasksLike = taskPhases[phase];
    if (taskOrTasksLike) {
      taskPhases[phase] = Array.isArray(taskOrTasksLike)
        ? taskOrTasksLike
        : [ taskOrTasksLike ]
      ;
    }
  }
  return taskPhases as NormalizedTaskPhases;
}

export function getTaskDataInput<T>(jobMeta: JobMetadata, tasks: NgPackagrBuilderTaskOptions<NgPackagrBuilderTaskSchema>) {
  const data = tasks.data || {};
  return { [jobMeta.selector]: data[jobMeta.selector] };
}

export async function validateTypedTasks(jobs: JobMetadata[],
                                         context: BuilderContext,
                                         tasks: NgPackagrBuilderTaskOptions<NgPackagrBuilderTaskSchema>) {

  const allHooksPromises: Promise<any>[] = [];

  const promises = jobs.map( taskMeta => {
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

  await Promise.all(allHooksPromises);
}

export interface EntryPointStorage { }

// Used to mimic the `data` object in `EntryPointNode` so we can bind things to an entry point through the pipes
// external to ng-packager.
export const ENTRY_POINT_STORAGE = {
  ENTRY_POINT_DATA: new WeakMap<EntryPointNode, EntryPointStorage>(),
  get(node: EntryPointNode): EntryPointStorage | undefined {
    return this.ENTRY_POINT_DATA.get(node);
  },
  merge(node: EntryPointNode, data: Partial<EntryPointStorage>): void {
    const currentData = this.ENTRY_POINT_DATA.get(node) || {} as any;
    Object.assign(currentData, data);
    this.ENTRY_POINT_DATA.set(node, currentData);
  },
  delete(node: EntryPointNode): boolean {
    return this.ENTRY_POINT_DATA.delete(node);
  }
}
