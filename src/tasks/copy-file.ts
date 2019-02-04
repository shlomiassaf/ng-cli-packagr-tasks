import * as Path from 'path';
import * as FS from 'fs';

import * as globby from 'globby';
import { resolve, virtualFs } from '@angular-devkit/core';
import { AssetPattern } from '@angular-devkit/build-angular';
import { normalizeAssetPatterns } from '@angular-devkit/build-angular/src/utils/normalize-asset-patterns';
import * as log from 'ng-packagr/lib/util/log';

import { EntryPointTaskContext, TypedTask } from '../build';

declare module '../build/hooks' {
  interface NgPackagrBuilderTaskSchema {
    copyFiles: {
      assets: AssetPattern[];
    }
  }
}

async function copyFilesTask(context: EntryPointTaskContext) {

  const globalContext = context.context();
  if (context.epNode.data.entryPoint.isSecondaryEntryPoint) {
    return;
  }

  const { builderContext, builderConfig } = globalContext;
  const root = builderContext.workspace.root;
  const projectRoot = resolve(root, builderConfig.root);
  const host = new virtualFs.AliasHost(builderContext.host as virtualFs.Host<FS.Stats>);
  const syncHost = new virtualFs.SyncDelegateHost<FS.Stats>(host);

  const assets = normalizeAssetPatterns(
    builderConfig.options.tasks.data.copyFiles.assets,
    syncHost,
    root,
    projectRoot,
    builderConfig.sourceRoot,
  );

  const copyPatterns = buildCopyPatterns(root, assets);
  const copyOptions = { ignore: ['.gitkeep', '**/.DS_Store', '**/Thumbs.db'] };

  log.info('Copying assets');

  const w = copyPatterns.map( pattern => {
    const fullPattern = pattern.context + pattern.from.glob;
    const opts = { ...copyOptions, dot: pattern.from.dot };
    return globby(fullPattern, opts).then(entries => {
      entries.forEach( entry => {
        const cleanFilePath = entry.replace(pattern.context, '');
        const to = Path.resolve(root, pattern.to, cleanFilePath);
        const pathToFolder = Path.dirname(to);
        pathToFolder.split('/').reduce((p, folder) => {
          p += folder + '/';
          
          if (!FS.existsSync(p)) {
            FS.mkdirSync(p);
          }
          return p;
        }, '');

        FS.copyFileSync(entry, to);
        log.success(` - from: ${entry}`);
        log.success(` - to: ${to}`);
      });
    });
  });

  try {
    await Promise.all(w);
  } catch (err) {
    builderContext.logger.error(err.toString());
    throw err;
  }
}

function buildCopyPatterns(root: string, assets: ReturnType< typeof normalizeAssetPatterns>) {
  return assets.map( asset => {

    // Resolve input paths relative to workspace root and add slash at the end.
    asset.input = Path.resolve(root, asset.input).replace(/\\/g, '/');
    asset.input = asset.input.endsWith('/') ? asset.input : asset.input + '/';
    asset.output = asset.output.endsWith('/') ? asset.output : asset.output + '/';

    if (asset.output.startsWith('..')) {
      const message = 'An asset cannot be written to a location outside of the output path.';
      throw new Error(message);
    }

    return {
      context: asset.input,
      // Now we remove starting slash to make Webpack place it from the output root.
      to: asset.output.replace(/^\//, ''),
      ignore: asset.ignore,
      from: {
        glob: asset.glob,
        dot: true,
      },
    };
  });
}

export const copyFiles: TypedTask = {
  schema: Path.resolve(__dirname, 'copy-file.json'),
  selector: 'copyFiles',
  handler: copyFilesTask,
};