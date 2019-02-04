# Example: Copy files & bump version

In this example we are using 2 built-in tasks:

- copy-file
- bump

The `copy-file` tasks will copy files based on instructions in the `angular.json` in the same format as `assets` in browser builds.  
Data is set in `tasks.data.copyFile` (for the `copy-file` task)

> The json structure is validated and will throw if invalid.

The `bump` task can also accept instructions through the `tasks.data` object but instead we will use a command line argument to
tell the task when to run and when not to run (no cli argument).

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
          "copyFiles": {
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

The configuration file (`copy-files-and-bump.ts`) is very simple, it just registers the tasks in the proper hook and phase.
In out case, in the `writePackage` hook at the `before` phase.