/**
 * Example: Create documentation after building package.
 * 
 * This example doesn't render documentation, it will only create a JSON schema with all metadata required to build
 * documentation for the library.
 * 
 * To extract TS type metadata we are using `@microsoft/api-extractor`.
 */

import { NgPackagerTransformerHooks, NgPackagerTransformerHooksContext, EntryPointTaskContext } from 'ng-cli-packagr-tasks';

module.exports = function(ctx: NgPackagerTransformerHooksContext) {
  async function writePackageTransformer(taskContext: EntryPointTaskContext) {
    const entryPointNode = taskContext.epNode;
  
    // `api-extractor` works by analyzing the `d.ts` declaration output created when compiling TS.
    // We need to pass the path to the root "typings" file (public_api) and this is stored here:
    const publicApiFilePath = entryPointNode.data.destinationFiles.declarations;
  
    // We need to pass a typescript configuration to the extractor.
    // We have one at `entryPointNode.data.tsConfig`, which is a a parsed configuration object (tsconfig.json after it was processed by TS).
    // We get it only for the `paths` which contain proper path mappings (important mostly in secondary packages).
    const tsConfig = entryPointNode.data.tsConfig;

    const tsConfigOptions = {
      include: [ publicApiFilePath ],
      exclude: ['libs', 'node_modules', 'tmp'],
      compilerOptions: {
        paths: JSON.parse(JSON.stringify(tsConfig.options.paths || []))
      },
    };
  
    const logger = {
      logVerbose(message: string): void { ctx.logger.debug(message); },
      logInfo(message: string): void { ctx.logger.info(message); },
      logWarning(message: string): void { ctx.logger.warn(message); },
      logError(message: string): void { ctx.logger.error(message); },
    };
    const apiPackage = getApiPackage(publicApiFilePath, tsConfigOptions, logger);
  
    const apiExtractorFilePath = Path.join(Path.dirname(publicApiFilePath), 'api-extractor.json');
    apiPackage.saveToJsonFile(apiExtractorFilePath, {
      newlineConversion: NewlineKind.CrLf,
      ensureFolderExists: true
    });
  }

  // Note that we create a new TS compilation without reusing the previous program.
  // We have access to it (entryPointNode.cache.oldPrograms) but it refers to the source files and not declaration (d.ts) files that the extractor wants....
  const hooks: NgPackagerTransformerHooks = {
    writePackage: {
      after: writePackageTransformer
    },
  };
  return hooks;
}




/* PROGRAMMATICALLY CREATE API METADATA FOR DOCS USING `@microsoft/api-extractor` */

import * as Path from 'path';
import { NewlineKind } from '@microsoft/node-core-library';
import * as ts from '@microsoft/api-extractor/node_modules/typescript';
import { ILogger } from '@microsoft/api-extractor/lib/api/ILogger';
import { Collector } from '@microsoft/api-extractor/lib/collector/Collector';
import { ApiModelGenerator } from '@microsoft/api-extractor/lib/generators/ApiModelGenerator';
import { ApiPackage } from '@microsoft/api-extractor/lib/api/model/ApiPackage';


const TS_DEFAULT_CONFIG_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES5,
  module: ts.ModuleKind.ES2015,
  lib: [ "es2017", "dom" ],
  baseUrl: '.',
  rootDir: '.',
}

export function getApiPackage(entryPoint: string, tsConfigJson: any, logger: ILogger): ApiPackage {
  const compilerOptions = tsConfigJson.compilerOptions || {};
  const parsedCommandLine: ts.ParsedCommandLine = ts.parseJsonConfigFileContent(
    { ...tsConfigJson, compilerOptions: { ...TS_DEFAULT_CONFIG_OPTIONS, ...compilerOptions } },
    ts.sys,
    process.cwd()
  );

  const program: ts.Program = ts.createProgram(parsedCommandLine.fileNames, parsedCommandLine.options);
  const rootDir: string | undefined = program.getCompilerOptions().rootDir;

  const collector: Collector = new Collector({
    program: program as any,
    entryPointFile: Path.isAbsolute(entryPoint) || !rootDir ? entryPoint : Path.resolve(rootDir, entryPoint),
    logger,
    policies: {},
    validationRules: {},
  });

  collector.analyze();
  const modelBuilder: ApiModelGenerator = new ApiModelGenerator(collector);
  return modelBuilder.buildApiPackage();
}