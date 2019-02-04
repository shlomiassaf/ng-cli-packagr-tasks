/**
 * Example: Update tsconfig settings before compilation in secondary entry points.
 */

import { NgPackagerTransformerHooks, NgPackagerTransformerHooksContext } from 'ng-cli-packagr-tasks';
import { isEntryPoint } from 'ng-packagr/lib/ng-v5/nodes';

module.exports = function(ctx: NgPackagerTransformerHooksContext) {
  const hooks: NgPackagerTransformerHooks = {
    initTsConfig: {
      after: async taskContext => {
        for (const entry of taskContext.graph.entries()) {
          if (isEntryPoint(entry)) {
            if (entry.data.entryPoint.isSecondaryEntryPoint) {
              // UPDATE VALUES IN TSCONFIG:
              const tsConfig = entry.data.tsConfig;
              tsConfig.options.noImplicitAny = true

              // OR REPLACE IT ENTIRELY:
              entry.data.tsConfig = tsConfig;

              // NOTE: The tsconfig in `entry.data.tsConfig` is of type `ParsedConfiguration` in `@angular/compiler-cli`.
              // Its not the raw `tsconfig.json` style and include additional properties used the the compiler CLI.
              // Your best bet is to update rather the replace.
            }
          }
        }
      }
    },
  };
  return hooks;
}
