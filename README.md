# Angular CLI Packagr Tasks

Tasks & Workflow for ng-packagr.

`ng-packagr` works like a classic task manager, running task in a certain order that is required to create an angular package.
It also provides the logic for all tasks internally, based on the angular package format spec.

This closed box does its job well, but what if we want additional steps before/after the packaging? What if we want to change the order, behaviour or logic of each
step within the packagr? How can we filter certain packages from building (secondary), etc...

`ng-packger` supports this through a programmatic API that is not accessible when using it through the `angular-cli`, this is where `ng-cli-packagr-tasks` comes in.

## Install

```bash
yarn add ng-cli-packagr-tasks -D
```

## Configuration

Here is a simple CLI configuration for a library (`angular.json`):

```json
"architect": {
  "build": {
    "builder": "@angular-devkit/build-ng-packagr:build",
    "options": {
      "tsConfig": "tsconfig.lib.json",
      "project": "ng-package.json"
    },
    "configurations": {
      "production": {
        "project": "ng-package.prod.json"
      }
    }
  }
}
```

This will run the classic `ng-packagr` build process.

**Let's update it a bit:**

```json
"architect": {
  "build": {
    "builder": "ng-cli-packagr-tasks:build",
    "options": {
      "tsConfig": "tsconfig.lib.json",
      "project": "ng-package.json",
      "transformConfig": "ng-packagr.transformers.ts"
    },
    "configurations": {
      "production": {
        "project": "ng-package.prod.json"
      }
    }
  }
}
```

We've introduces 2 changes:

- The **builder** has changed from `@angular-devkit/build-ng-packagr:build` to `ng-cli-packagr-tasks:build`.
- The property **transformConfig** was added, pointing to a configuration module where we can tweak the process.

> Note that `ng-packagr` itself does not change, only the architect builder.

### Configuration module

The configuration module is a simple JS (or TS) file that exports (default) the transformation instructions, there are 2 ways:

- Direct transformer hook configuration (`NgPackagerTransformerHooks`)
- A function that returns a transformer hook configuration or a Promise. `() => NgPackagerTransformerHooks | Promise<NgPackagerTransformerHooks>`

> This is Similar to webpack

Regardless of how you choose to export the instructions (function or object), the end result is always the `NgPackagerTransformerHooks`

> When using a function, an additional context parameter is provided, holding the root directory and a logger.

### Packagr tasks (`NgPackagerTransformerHooks`)

`ng-packagr` run tasks, in a certain order, that together form the process of creating a library in the angular package format spec.

`NgPackagerTransformerHooks` is a map of hooks within the packaging process that you can tap in to, each hook correspond to a specific packagr task.

```ts
export interface NgPackagerTransformerHooks {
  initTsConfig?: TransformerHook<TaskContext<[ParsedConfiguration]>>;
  analyseSources?: TransformerHook<TaskContext>;
  entryPoint?: TransformerHook;
  compileNgc?: TransformerHook;
  writeBundles?: TransformerHook;
  writePackage?: TransformerHook;
}
```

> The order which the tasks run reflect in the order of the properties above.

For example, `compileNgc` will compile the library (TS -> JS, twice in 2 formats).

> `ng-packager` has more tasks, running before `analyseSources` but they do not provide any value for customization.

## Task phases (`TransformerHook`)

For each hook there are 3 phases which you can register (all optional): **before**, **replace** and **after**

```ts
export interface TransformerHook<T> {
  before?: HookHandler<T>;
  replace?: HookHandler<T>;
  after?: HookHandler<T>;
}
```

The order which the phases run are: **before** -> **replace** -> **after**

The timeline is relative to the **replace** phase, which is where the original `ng-packagr` task runs.
If you set a hook handler in **replace** the original task from `ng-packagr` **WILL NOT RUN**.

> Do not set a handler in **replace** unless you really know what you are doing!

Each `HookHandler` is a function that handles handles that hook:

```ts
export type HookHandler<T> = (taskContext: T) => BuildGraph | undefined | Promise<BuildGraph | undefined>;
```

The hook is invoked with a `taskContext` parameter.
We can see from the generic (T) that there is more then one types of handler, there are 2:

```ts
/**
 * A context for hooks running at the initialization phase, when all entry points are discovered and all initial values are loaded.
 */
export interface TaskContext<T = any[]> {
  factoryInjections: T;
  graph: BuildGraph;
}

/**
 * A context for hook handlers running at the processing phase, where each entry point is being processed in a sequence, one after the other.
 */
export interface EntryPointTaskContext<T = any[]> extends TaskContext<T> {
  epNode: EntryPointNode;
}
```

> `EntryPointTaskContext` handlers are called multiple times, once for every package (primary and secondary). `TaskContext` is called once before starting to process packages

## Examples

Before we dive into examples, it's important that we understand what information is available to us, provided by `ng-packagr`.

Most of it is stored in `EntryPointNode`. The `EntryPointNode` object contains a lot of things. File path locations (sources, destinations), cached files, cache TS compiler programs and more...

If we want to copy or move files, delete, build something etc, we need to know where the resources are located...

There isn't much documentation, but [it is typed which should be enough](https://github.com/ng-packagr/ng-packagr/blob/master/src/lib/ng-v5/nodes.ts).

- [Filtering build of packages](/examples/filter-packages.ts)
- [Copy file to built packages](/examples/copy-files.ts)
- [API Metadata generator](/examples/api-generator.ts)
- [API Metadata generator](/examples/update-tsconfig-for-secondary-entry-points.ts)

TODO:

- Example on information in `EntryPointNode` (destination, metadata etc...)
- Example for theme builder (e.g. scss)
