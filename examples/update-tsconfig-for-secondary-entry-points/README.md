# Example: Update tsconfig settings before compilation in secondary entry points

This example does not use a built-in task, instead it will provide a handler to the
`initTsConfig` hook at the `after` phase and will update the typescript configuration of each secondary build.

This is a simple way to differentiate TS compilation for secondary entry points.

In this example we update the configuration programmatically, a more clever approach will be to
identify the architect configuration for the secondary build and use the `tsconfig` in it to load the configuration we want.

This will require auto-matching between secondary packages and architect project names, which is not direct but inferred. It might
be better to use a configuration on the primary project with maps to child projects.

With this, we ensure that we only build specific child packages and we use custom build configurations for each. It also serves
as a good starting point to perform build only on affected secondary libs (NX).
