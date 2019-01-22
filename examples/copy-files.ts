/**
 * Example: Copy the `LICENSE` file to the root of every package
 * 
 * This can be extended to support complex copy instruction passed through `transformData`
 */

import * as Path from 'path';
import * as FS from 'fs';
import { NgPackagerTransformerHooks, NgPackagerTransformerHooksContext } from 'ng-cli-packagr-tasks';

module.exports = function(ctx: NgPackagerTransformerHooksContext) {
  const hooks: NgPackagerTransformerHooks = {
    writePackage: {
      after: async taskContext => {
        const srcFile = Path.join(ctx.root, 'LICENSE');
        const dstFile = Path.join(taskContext.epNode.data.entryPoint.destinationPath, 'LICENSE');
        return new Promise<void>( (res, rej) => {
          FS.copyFile(srcFile, dstFile, err => err ? rej(err) : res());
        });
      }
    },
  };
  return hooks;
}
