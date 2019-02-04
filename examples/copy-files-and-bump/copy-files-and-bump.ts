/**
 * Example: Copy files and bump version
 */

import { NgPackagerTransformerHooks, NgPackagerTransformerHooksContext } from 'ng-cli-packagr-tasks';
import { copyFiles } from 'ng-cli-packagr-tasks/dist/tasks/copy-file';
import { bump } from 'ng-cli-packagr-tasks/dist/tasks/bump';

module.exports = function(ctx: NgPackagerTransformerHooksContext) {
  const hooks: NgPackagerTransformerHooks = {
    writePackage: [copyFiles, bump],
  };
  return hooks;
}
