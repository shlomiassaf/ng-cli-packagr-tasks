import * as FS from 'fs';
import { Observable, from } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

import { BuildEvent, BuilderConfiguration } from '@angular-devkit/architect';
import * as devKitCore from '@angular-devkit/core';
import { NgPackagrBuilder as _NgPackagrBuilder, NgPackagrBuilderOptions } from '@angular-devkit/build-ng-packagr';
import * as ngPackagr from 'ng-packagr';

// TODO: Remove when issue is fixed.
import './workaround-issue-1189';
import { NgPackagerTransformerHooks, NgPackagerTransformerHooksModule } from './hooks';
import { createHookProviders } from './create-hook-provider';

export * from './hooks';

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

  run(builderConfig: BuilderConfiguration<NgPackagrBuilderOptions>): Observable<BuildEvent> {
    this.options = builderConfig.options;
    const { build, watch } = ngPackagr.NgPackagr.prototype;

    return from(this.getTransformerHooks(this.options.transformConfig))
      .pipe(
        tap( transformerHooks => {
          const providers = createHookProviders(transformerHooks);
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

  private getTransformerHooks(transformerPath: string): Promise<NgPackagerTransformerHooks> {
    const root = this.context.workspace.root;
    const tPath = devKitCore.resolve(root, devKitCore.normalize(transformerPath));
    if (FS.existsSync(tPath)) {
      if (/\.ts$/.test(tPath) && !require.extensions['.ts']) {
        const tsNodeOptions = {} as any;
        if (this.options.transformTsConfig) {
          tsNodeOptions.project = this.options.transformTsConfig;
        } else {
          tsNodeOptions.compilerOptions = DEFAULT_TSCONFIG_OPTIONS;
        }
        require('ts-node').register(tsNodeOptions);
      }
      const transformHooks: NgPackagerTransformerHooksModule = require(tPath);

      if (typeof transformHooks === 'function') {
        const ctx = {
          logger: this.context.logger,
          root,
        }
        return Promise.resolve(transformHooks(ctx));
      } else {
        return Promise.resolve(transformHooks);
      }
    };
    return Promise.resolve({});
  }
}

export default NgPackagrBuilder;
