# Example: Node Library

In this example we are using the built in **job** `nodeLib` and just to add some flavour we also perform a copy using the `copyFile` **job**.

`nodeLib` will disable all angular related build steps (ts compilation, package.json definitions, bundles) and create a simple TS compilation
using a provided TS configuration file (optional) or the project's tsconfig when not set.

## Angular CLI config (partial from `angular.json`)

```json
"architect": {
  "build": {
    "builder": "ng-cli-packagr-tasks:build",
    "options": {
      "tsConfig": "tsconfig.lib.json",
      "project": "ng-package.json",
      "tasks": {
        "config": "copy-files-and-bump.ts",
        "data": {
          "nodeLib": {
            "tsConfig": "tsconfig.node-lib.json"
          },
          "copyFile": {
            "assets": [
              {
                "glob": "**/*.txt",
                "input": "src",
                "output": "dist"
              }
            ]
          }
        }
      }
    }
  }
}
```

> Dont forget `module: "commonjs"` in the ts configuration file.

The `ng-package.json` file does not change, similar to an angular package build it will hold instructions for the `entryFile`, destination folder etc...

`ng-package.json` contains instructions specific to angular package builds, such instructions are ignored when using the node library job. (cssUrl, umdId, etc...).

## Post Processing

Post processing tasks are not part of the scope, `nodeLib` will only compile the library and create a `package.json` for it. To perform other tasks add additional **jobs**.

In this example we are copying files post creation.