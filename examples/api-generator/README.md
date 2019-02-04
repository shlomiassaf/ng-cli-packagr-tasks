# Example: Create documentation after building package

In this example we generate documentation for the library after it was built.
This example doesn't render documentation, it will only create a JSON schema with all metadata required to build documentation for the library.
To extract TS type metadata we are using `@microsoft/api-extractor`.

This example does not use a built-in task, instead it will provide a handler to the
`writePackage` hook at the `after` phase and will just remove all secondary entry points from the primary entry point.

This is a simple task that demonstrate how we can chain operations. It also uses the `ng-packagr` API to find the
file required to generate the docs.
