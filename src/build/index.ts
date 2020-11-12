import * as FS from 'fs';
import { Observable, from } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

import * as devKitCore from '@angular-devkit/core';
import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { executeNgPackagrBuilder as _execute, NgPackagrBuilderOptions } from '@angular-devkit/build-angular';
import * as ngPackagr from 'ng-packagr';

import { NgPackagerHooksModule, NgPackagerHooksContext } from './hooks';
import { createHookProviders } from './create-hook-provider';
import { createHooksContext, validateTypedTasks } from './utils';
import { HookRegistry } from './hook-registry';

export * from './hooks';
export * from './hook-registry';
export { Job, JobMetadata, Type } from './job';
export { ENTRY_POINT_STORAGE, EntryPointStorage } from './utils';

const DEFAULT_TSCONFIG_OPTIONS = {
  moduleResolution: 'node',
  module: 'commonjs',
  target: 'es6',
  lib: [
    'es2017',
    'dom'
  ],
};

async function buildRegistry(globalTasksContext: NgPackagerHooksContext): Promise<HookRegistry> {
  const root = globalTasksContext.root;
  const { tasks } = globalTasksContext.options;
  const transformerPath = tasks.config;
  const tPath = devKitCore.getSystemPath(devKitCore.resolve(root, devKitCore.normalize(transformerPath)) as any);
  if (FS.existsSync(tPath)) {
    if (/\.ts$/.test(tPath) && !require.extensions['.ts']) {
      const tsNodeOptions = {} as any;
      if (tasks.tsConfig) {
        tsNodeOptions.project = tasks.tsConfig;
      } else {
        tsNodeOptions.compilerOptions = DEFAULT_TSCONFIG_OPTIONS;
      }
      require('ts-node').register(tsNodeOptions);
    }
    const transformHooksModule: NgPackagerHooksModule = require(tPath);

    if (typeof transformHooksModule === 'function') {
      const registry = new HookRegistry();
      await transformHooksModule(globalTasksContext, registry);
      return registry;
    } else {
      const registry = new HookRegistry(transformHooksModule);
      return registry;
    }
  };
  return Promise.resolve(new HookRegistry());
}

async function initRegistry(options: NgPackagrBuilderOptions, builderContext: BuilderContext) {
  const context = await createHooksContext(options, builderContext);
  const registry = await buildRegistry(context);
  return { context, registry };
}

export function execute(options: NgPackagrBuilderOptions, context: BuilderContext): Observable<BuilderOutput> {
  const { build, watch } = ngPackagr.NgPackagr.prototype;

  return from (initRegistry(options, context))
  .pipe(
    switchMap( result => validateTypedTasks(result.registry.getJobs(), result.context).then( () => result ) ),
    tap( result => {        
      const providers = createHookProviders(result.registry.getHooks(), result.context);
      ngPackagr.NgPackagr.prototype.build = function (this: ngPackagr.NgPackagr) {
        this.withProviders(providers);
        return build.call(this);
      }
      ngPackagr.NgPackagr.prototype.watch = function (this: ngPackagr.NgPackagr) {
        this.withProviders(providers);
        if (result.registry.hasSelfWatchJob) {
          return this.buildAsObservable();
        } else {
          return watch.call(this); 
        }
      }
    }),
    switchMap( () => _execute(options, context) ),
    tap( buildEvent => {
      ngPackagr.NgPackagr.prototype.build = build;
      ngPackagr.NgPackagr.prototype.watch = watch;
    }),
  );
}

export default createBuilder<Record<string, string> & NgPackagrBuilderOptions>(execute);