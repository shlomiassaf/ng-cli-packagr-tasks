/**
 * Example: Filter all secondary endpoints, build only primary.
 * 
 * This can be extended to support compilation of affected packages only. (commit changed).
 */


import { NgPackagerHooks, NgPackagerHooksContext } from 'ng-cli-packagr-tasks';
import { isEntryPoint } from 'ng-packagr/lib/ng-v5/nodes';

module.exports = function(ctx: NgPackagerHooksContext) {
  const hooks: NgPackagerHooks = {
    initTsConfig: {
      before: async taskContext => {
        for (const entry of taskContext.graph.entries()) {
          if (isEntryPoint(entry)) {
            if (entry.data.entryPoint.isSecondaryEntryPoint) {
              entry.state = 'done';
            }
          }
        }
      }
    },
  };
  return hooks;
}
