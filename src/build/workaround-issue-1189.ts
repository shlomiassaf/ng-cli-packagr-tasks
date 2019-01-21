// THIS IS A PATCH TO FIX TSICKLE ISSUE
// SEE https://github.com/ng-packagr/ng-packagr/issues/1189
// TODO: Remove when issue is fixed.
import 'ng-packagr/lib/ngc/create-emit-callback';
const tsickle = require("tsickle/src/tsickle");
const { emitWithTsickle } = tsickle;
tsickle.emitWithTsickle = function(...args: any[]) {
  const host = args[1];
  if (!host.moduleResolutionHost) {
    host.moduleResolutionHost = host.host;
  }
  return emitWithTsickle.apply(this, args);
}
