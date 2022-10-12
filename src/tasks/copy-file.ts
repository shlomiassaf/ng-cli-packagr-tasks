import * as Path from 'path';
import * as FS from 'fs';

import * as globby from 'globby';
import { AssetPattern } from '@angular-devkit/build-angular';
import { normalizeAssetPatterns } from '@angular-devkit/build-angular/src/utils/normalize-asset-patterns';
import * as log from 'ng-packagr/lib/utils/log';

import { EntryPointTaskContext, Job } from '../build';

declare module '../build/hooks' {
  interface NgPackagrBuilderTaskSchema {
    copyFile: {
      assets: AssetPattern[];
    }
  }
}

export interface CopyPattern {
  context: string;
  to: string;
  ignore: string[];
  from: {
      glob: string;
      dot: boolean;
  };
}

function buildCopyPatterns(root: string, assets: ReturnType< typeof normalizeAssetPatterns>): CopyPattern[] {
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

function createCopyPatterns(assetPatterns: AssetPattern[], root: string, projectRoot: string, maybeSourceRoot: string) {

  const assets = normalizeAssetPatterns(
    assetPatterns,
    root,
    projectRoot,
    maybeSourceRoot,
  );

  return buildCopyPatterns(root, assets);
}

async function getGlobEntries(copyPattern: CopyPattern, copyOptions: globby.GlobbyOptions) {
  const fullPattern = copyPattern.context + copyPattern.from.glob;
  const opts = { ...copyOptions, dot: copyPattern.from.dot };

  return globby(fullPattern, opts);
}

async function executeCopyPattern(copyPattern: CopyPattern,
                                  copyOptions: globby.GlobbyOptions,
                                  root: string,
                                  onCopy?: (from: string, to: string) => void) {
  const entries = await getGlobEntries(copyPattern, copyOptions);

  for (const entry of entries) {
    const cleanFilePath = entry.replace(copyPattern.context, '');
    const to = Path.resolve(root, copyPattern.to, cleanFilePath);
    const pathToFolder = Path.dirname(to);

    pathToFolder.split('/').reduce((p, folder) => {
      p += folder + '/';
      
      if (!FS.existsSync(p)) {
        FS.mkdirSync(p);
      }

      return p;
    }, '');

    FS.copyFileSync(entry, to);

    if (onCopy) {
      onCopy(entry, to);
    }
  }
}

async function executeCopyPatterns(copyPatterns: CopyPattern[],
                                   root: string,
                                   copyOptions?: globby.GlobbyOptions,
                                   onCopy?: (pattern: CopyPattern, from: string, to: string) => void) {
  const opts = copyOptions ? { ...copyOptions } : {};
  for (const copyPattern of copyPatterns) {
    const singleOnCopy = onCopy
      ? (from: string, to: string) => onCopy(copyPattern, from, to)
      : undefined
    ;
    await executeCopyPattern(copyPattern, opts, root, singleOnCopy);
  }
}

async function copyFilesTask(context: EntryPointTaskContext) {

  const globalContext = context.context();
  if (context.epNode.data.entryPoint.isSecondaryEntryPoint) {
    return;
  }

  const { builderContext, options, root } = globalContext;

  const copyPatterns = createCopyPatterns(
    options.tasks.data.copyFile.assets,
    root,
    globalContext.projectRoot,
    globalContext.sourceRoot,
  );
  
  const copyOptions = { ignore: ['.gitkeep', '**/.DS_Store', '**/Thumbs.db'] };
  const onCopy = (pattern: CopyPattern, from: string, to: string) => {
    log.success(` - from: ${from}`);
    log.success(` - to: ${to}`);
  };

  log.info('Copying assets');

  try {
    await executeCopyPatterns(copyPatterns, root, copyOptions, onCopy);
  } catch (err) {
    builderContext.logger.error(err.toString());
    throw err;
  }
}


@Job({
  schema: Path.resolve(__dirname, 'copy-file.json'),
  selector: 'copyFile',
  hooks: {
    writePackage: {
      before: copyFilesTask
    }
  }
})
export class CopyFile {
  static readonly copyFilesTask = copyFilesTask;
  static readonly createCopyPatterns = createCopyPatterns;
  static readonly executeCopyPattern = executeCopyPattern;
  static readonly executeCopyPatterns = executeCopyPatterns;
}