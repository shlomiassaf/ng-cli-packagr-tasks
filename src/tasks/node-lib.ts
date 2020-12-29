
import * as Path from 'path';
import * as ts from 'typescript';
import * as ng from '@angular/compiler-cli';

import { setDependenciesTsConfigPaths } from 'ng-packagr/lib/ts/tsconfig';
import { isEntryPoint, EntryPointNode } from 'ng-packagr/lib/ng-package/nodes';
// import { writePackageJson } from 'ng-packagr/lib/ng-package/entry-point/write-package.transform';
import { NgPackage } from 'ng-packagr/lib/ng-package/package';
import { ensureUnixPath } from 'ng-packagr/lib/utils/path';
import * as log from 'ng-packagr/lib/utils/log';

import { TaskContext, EntryPointTaskContext, Job, ENTRY_POINT_STORAGE, EntryPointStorage } from '../build';

declare module '../build/hooks' {
  interface NgPackagrBuilderTaskSchema {
    nodeLib: {
      /**
       * The file path of the TypeScript configuration file, specific for node library generation.
       * If not set will use the tsConfig of the project
       */
      tsConfig?: string;
    
      /**
       * Compiler options overriding the one's in the file
       */
      compilerOptions?: ts.CompilerOptions;
    }
  }
}

declare module '../build/utils' {
  interface EntryPointStorage {
    nodeLib: {
      tsConfig: Pick<ts.CreateProgramOptions, 'rootNames' | 'options' | 'projectReferences'>;
      watchProgram?: ts.WatchOfFilesAndCompilerOptions<ts.EmitAndSemanticDiagnosticsBuilderProgram>;
    }
  }
}

function readTsConfig(configFile: string): ts.ParsedCommandLine {
  const rawConfigRead = ts.readConfigFile(configFile, ts.sys.readFile);
  if (rawConfigRead.error) {
    return {
      options: {},
      fileNames: [],
      errors: [ rawConfigRead.error ],
    };
  }

  return ts.parseJsonConfigFileContent(rawConfigRead.config, ts.sys, Path.dirname(configFile), undefined, Path.basename(configFile));  
}

/**
 * Run after the original initTsConfig and load the user tsconfig override, if given or the root tsConfig file.
 * We reload the configuration from scratch and create configuration parameters for a simple tsc compilation without the angular compiler stuff.
 * We run "after" and not "replace" because there are a lot of areas depending on the angular compiler `ParsedConfiguration` object.
 */
async function initTsConfig(context: TaskContext<[ng.ParsedConfiguration]>) {
  const globalContext = context.context();
  const nodeLib = globalContext.options.tasks.data.nodeLib || {};

  const tsConfigPath = (nodeLib && nodeLib.tsConfig) || globalContext.options.tsConfig;
  const parsedTsConfig = readTsConfig(tsConfigPath);

  if (parsedTsConfig.errors.length > 0) {
    const exitCode = ng.exitCodeFromResult(parsedTsConfig.errors);
    if (exitCode !== 0) {
      return Promise.reject(new Error(ng.formatDiagnostics(parsedTsConfig.errors)));
    }
  }
  
  const entryPoints = context.graph.filter(isEntryPoint) as EntryPointNode[];

  for (const entryPointNode of entryPoints) {
    const { entryPoint } = entryPointNode.data;
    log.debug(`Initializing tsconfig for ${entryPoint.moduleId}`);
    const rootDir = Path.dirname(entryPoint.entryFilePath);

    const userOverridingCompilerOptions = nodeLib.compilerOptions || {};
    const overrideOptions: ts.CompilerOptions = {
      ...userOverridingCompilerOptions,
      rootDir,
      outDir: entryPoint.destinationPath
    };

    const tsConfig: EntryPointStorage['nodeLib']['tsConfig'] = {
      rootNames: [ entryPoint.entryFilePath ],
      options: Object.assign(JSON.parse(JSON.stringify(parsedTsConfig.options)), overrideOptions),
      projectReferences: parsedTsConfig.projectReferences,
    };

    ENTRY_POINT_STORAGE.merge(entryPointNode, {
      nodeLib: { tsConfig }
    });
  }

  return Promise.resolve(context.graph);
}

/**
 * Replace the original compilation step, compile for node and not for angular.
 */
async function compilerNgc(context: EntryPointTaskContext) {
  const { epNode } = context;
  const nodeLibCache = ENTRY_POINT_STORAGE.get(epNode).nodeLib;

  if (context.context().options.watch) {
    if (nodeLibCache.watchProgram) {
      return;
    }

    const formatHost: ts.FormatDiagnosticsHost = {
      getCanonicalFileName: path => path,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine: () => ts.sys.newLine
    };

    const entryPoints = context.graph.filter(isEntryPoint) as EntryPointNode[];
  
    // Add paths mappings for dependencies
    const ngParsedTsConfig = setDependenciesTsConfigPaths(epNode.data.tsConfig, entryPoints);
    const tsConfig: EntryPointStorage['nodeLib']['tsConfig'] = JSON.parse(JSON.stringify(nodeLibCache.tsConfig));
    tsConfig.options.paths = ngParsedTsConfig.options.paths;
  
    const host = ts.createWatchCompilerHost(
      tsConfig.rootNames as any,
      tsConfig.options,
      ts.sys,
      ts.createEmitAndSemanticDiagnosticsBuilderProgram,
      (diagnostic: ts.Diagnostic) => log.error(ng.formatDiagnostics([diagnostic], formatHost)),
      (diagnostic: ts.Diagnostic) => log.msg(ts.formatDiagnostic(diagnostic, formatHost)),
      tsConfig.projectReferences,
    );
    const program = ts.createWatchProgram<ts.EmitAndSemanticDiagnosticsBuilderProgram>(host);
    nodeLibCache.watchProgram = program;
  
  } else {
    const entryPoints = context.graph.filter(isEntryPoint) as EntryPointNode[];
  
    // Add paths mappings for dependencies
    const ngParsedTsConfig = setDependenciesTsConfigPaths(epNode.data.tsConfig, entryPoints);
    const tsConfig: EntryPointStorage['nodeLib']['tsConfig'] = JSON.parse(JSON.stringify(nodeLibCache.tsConfig));
    tsConfig.options.paths = ngParsedTsConfig.options.paths;
  
    const scriptTarget = tsConfig.options.target;
    const cache = epNode.cache;
    const oldProgram = cache.oldPrograms && (cache.oldPrograms[scriptTarget] as ts.Program | undefined);

    const program = ts.createProgram({
      rootNames: tsConfig.rootNames,
      options: tsConfig.options,
      oldProgram,
    });

    cache.oldPrograms = { ...cache.oldPrograms, [scriptTarget]: program };

    const emitResult = program.emit();
    const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
  
    log.debug(
      `ngc program structure is reused: ${
        oldProgram ? (oldProgram as any).structureIsReused : 'No old program'
      }`
    );
  
    const exitCode = ng.exitCodeFromResult(allDiagnostics);
    if (exitCode !== 0) {
      throw new Error(ng.formatDiagnostics(allDiagnostics));
    }
  }
}

/**
 * Replace the original package.json create logic, write values for a node library.
 */
async function writePackage(context: EntryPointTaskContext) {
  const { tsConfig, entryPoint } = context.epNode.data;
  const ngPackage: NgPackage = context.graph.find(node => node.type === 'application/ng-package').data;

  log.info('Writing package metadata');
  const relativeUnixFromDestPath = (filePath: string) =>
    ensureUnixPath(Path.relative(entryPoint.destinationPath, filePath));

  // TODO: This will map the entry file to it's emitted output path taking rootDir into account.
  // It might not be fully accurate, consider using the compiler host to create a direct map.
  const distEntryFile = Path.join(entryPoint.destinationPath, Path.relative(tsConfig.options.rootDir, entryPoint.entryFilePath)).replace(/\.ts$/, '.js');
  const distDtsEntryFile = distEntryFile.replace(/\.js$/, '.d.ts');

  // await writePackageJson(entryPoint, ngPackage, {
  //   main: relativeUnixFromDestPath(distEntryFile),
  //   typings: relativeUnixFromDestPath(distDtsEntryFile),
  // });
  
  log.success(`Built ${entryPoint.moduleId}`);
}

@Job({
  schema: Path.resolve(__dirname, 'node-lib.json'),
  selector: 'nodeLib',
  internalWatch: true,
  hooks: {
    initTsConfig: {
      after: initTsConfig
    },
    compileNgc: {
      replace: compilerNgc
    },
    writeBundles: {
      replace: []
    },
    writePackage: {
      replace: writePackage
    }
  }
})
export class NodeLib {
  static readonly initTsConfig = initTsConfig;
  static readonly compilerNgc = compilerNgc;
  static readonly writePackage = writePackage;
}
