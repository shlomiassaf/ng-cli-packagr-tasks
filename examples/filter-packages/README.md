# Example: Filter all secondary endpoints, build only primary

This example does not use a built-in task, instead it will provide a handler to the
`initTsConfig` hook at the `before` phase and will just remove all secondary entry points from the primary entry point.

This is a simple task that demonstrate the use of `ng-packagr` API.
