import * as FS from 'fs';
import { Observable, from } from 'rxjs';
import { switchMap, map, tap } from 'rxjs/operators';

import { BuildEvent, BuilderConfiguration } from '@angular-devkit/architect';
import * as devKitCore from '@angular-devkit/core';
import { NgPackagrBuilder as _NgPackagrBuilder, NgPackagrBuilderOptions } from '@angular-devkit/build-ng-packagr';
import * as ngPackagr from 'ng-packagr';

// TODO: Remove when issue is fixed.
import './workaround-issue-1189';
import {
  NgPackagerHooksModule,
  NgPackagrBuilderOptionsWithTasks,
  NgPackagerHooksContext
} from './hooks';
import { createHookProviders } from './create-hook-provider';
import { validateTypedTasks } from './utils';
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

// Instead of re-writing NgPackagrBuilder in full, just for adding some providers, we will patch
// the NgPackager instead... ohh my!
export class NgPackagrBuilder extends _NgPackagrBuilder {
  private options: NgPackagrBuilderOptions;

  run(builderConfig: BuilderConfiguration<NgPackagrBuilderOptionsWithTasks>): Observable<BuildEvent> {
    const builderContext = this.context;
    this.options = builderConfig.options;
    const root = this.context.workspace.root;
    const { tasks } = this.options;
    const { build, watch } = ngPackagr.NgPackagr.prototype;

    const globalTasksContext = {
      logger: this.context.logger,
      root,
      builderContext,
      builderConfig
    };

    return from(this.buildRegistry(tasks.config, globalTasksContext))
      .pipe(
        switchMap( registry => validateTypedTasks(registry.getJobs(), this.context, tasks).then( () => registry ) ),
        tap( registry => {        
          const providers = createHookProviders(registry.getHooks(), globalTasksContext);
          ngPackagr.NgPackagr.prototype.build = function (this: ngPackagr.NgPackagr) {
            this.withProviders(providers);
            return build.call(this);
          }
          ngPackagr.NgPackagr.prototype.watch = function (this: ngPackagr.NgPackagr) {
            this.withProviders(providers);
            return watch.call(this);
          }
        }),
        switchMap( () => super.run(builderConfig) ),
        tap( buildEvent => {
          ngPackagr.NgPackagr.prototype.build = build;
          ngPackagr.NgPackagr.prototype.watch = watch;
        })
      );
  }

  private async buildRegistry(transformerPath: string, globalTasksContext: NgPackagerHooksContext): Promise<HookRegistry> {
    const { tasks } = this.options;
    const root = this.context.workspace.root;
    const tPath = devKitCore.getSystemPath(devKitCore.resolve(root, devKitCore.normalize(transformerPath)));
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
}

export default NgPackagrBuilder;
