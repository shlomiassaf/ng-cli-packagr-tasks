import { map, tap, switchMap } from 'rxjs/operators';
import * as Path from 'path';
import * as semver from 'semver';
import { normalize, virtualFs, JsonObject, parseJson, JsonParseMode } from '@angular-devkit/core';
import * as log from 'ng-packagr/lib/utils/log';

import { EntryPointTaskContext, Job } from '../build';

const VALID_BUMPS: semver.ReleaseType[] = [
  'major',
  'premajor',
  'minor',
  'preminor',
  'patch',
  'prepatch',
  'prerelease'
];

declare module '../build/hooks' {
  interface NgPackagrBuilderTaskSchema {
    bump?: "major" | "premajor" | "minor" | "preminor" | "patch" | "prepatch" | "prerelease";
  }
}

async function bumpTask(context: EntryPointTaskContext) {
  const bump = context.taskArgs('bump') as semver.ReleaseType;
  if (!bump || context.epNode.data.entryPoint.isSecondaryEntryPoint) {
    return;
  }

  if (VALID_BUMPS.indexOf(bump) === -1) {
    const err = new Error(`BumpTask: Invalid semver version bump, ${bump} is not a known semver release type`);
    log.error(err.message);
    throw err;
  }

  const { entryPoint } = context.epNode.data;

  const ver = semver.parse(entryPoint.packageJson.version);
  const oldVersion = ver.version;
  const newVersion = semver.inc(ver, bump);
  entryPoint.packageJson.version = newVersion;

  const { host } = context.context().workspace;
  const packageJsonPath = normalize(Path.join(entryPoint.basePath, 'package.json'));
  await host.read(packageJsonPath)
    .pipe(
      map( buffer => virtualFs.fileBufferToString(buffer) ),
      map( str => parseJson(str, JsonParseMode.Loose) as {} as JsonObject ),
      tap( packageJson => packageJson.version = newVersion ),
      switchMap( packageJson => {
        return host.write(
          packageJsonPath,
          virtualFs.stringToFileBuffer(JSON.stringify(packageJson, null, 2))
        );
      }),
    )
    .toPromise();

  log.msg(`Version bumped from ${oldVersion} to ${newVersion} (${bump})`);
}

@Job({
  schema: Path.resolve(__dirname, 'bump.json'),
  selector: 'bump',
  hooks: {
    writePackage: {
      before: bumpTask
    }
  }
})
export class Bump { }
