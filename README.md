# Angular CLI Packagr Tasks

Tasks & Workflow for ng-packagr.

## TL;DR

Hook into the build steps of `ng-packger` and add custom behaviors or change the built in behaviors.

Examples:

- Copy files after package build
- Bump version (semver)

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
      "tasks": {
        "config": "ng-packagr.transformers.ts"
      }
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
- The property **tasks** was added, pointing to a configuration module where we can tweak the process.

> Note that `ng-packagr` itself does not change, only the architect builder.

The **tasks** object has additional properties which we can use to customize the process and provide configuration for
tasks. We will cover this shortly, for now let's focus on the configuration module (`tasks.config`).

### Configuration module

The configuration module is a simple JS (or TS) file that exports (default) the transformation instructions, there are 2 ways:

- Direct transformer hook configuration (`NgPackagerHooks`)
- A function that returns a transformer hook configuration or a Promise. `(ctx: NgPackagerHooksContext<T>) => NgPackagerTransformerHooks | Promise<NgPackagerTransformerHooks>`

> This is Similar to webpack

Regardless of how you choose to export the instructions (function or object), the end result is always the `NgPackagerTransformerHooks`

> When using a function, an additional context parameter is provided, holding metadata and API to perform complex operations.

### Packagr hooks (`NgPackagerTransformerHooks`)

`ng-packagr` has several build steps, in a certain order, that together form the process of creating a library in the angular package format spec.
`NgPackagerHooks` is a map of hooks within the packaging process that you can tap in to, each hook correspond to a specific packagr step.

```ts
export interface NgPackagerHooks {
  initTsConfig?: TaskPhases<TaskContext<[ParsedConfiguration]>>;
  analyseSources?: TaskPhases<TaskContext>;
  entryPoint?: TaskPhases;
  compileNgc?: TaskPhases;
  writeBundles?: TaskPhases;
  writePackage?: TaskPhases;
}
```
> The order which the tasks run reflect in the order of the properties above.

For example, `compileNgc` will compile the library (TS -> JS, twice in 2 formats).

> `ng-packager` has more tasks, running before `analyseSources` but they do not provide any value for customization.

Each hook is split into 3 phases...

## Task phases (`TransformerHook`)

For each hook there are 3 phases which you can register (all optional): **before**, **replace** and **after**

```ts
export interface TaskPhases<T = EntryPointTaskContext> {
  before?: TaskOrTasksLike<T>;
  replace?: TaskOrTasksLike<T>;
  after?: TaskOrTasksLike<T>;
}
```

The order which the phases run are: **before** -> **replace** -> **after**

The timeline is relative to the **replace** phase, which is where the original `ng-packagr` task runs.
If you set a hook handler in **replace** the original task from `ng-packagr` **WILL NOT RUN**.

> Do not set a handler in **replace** unless you really know what you are doing!

Each phase accepts a single task or an array of tasks, for now let's define a task as a function that handles that hook:

```ts
export type HookHandler<T> = (taskContext: T) => (BuildGraph | void | Promise<BuildGraph> | Promise<void>);
```

The hook is invoked with a `taskContext` parameter.

The context holds metadata and APIs for the current task and globally for the entire process.

```ts
/**
 * A context for hooks running at the initialization phase, when all entry points are discovered and all initial values are loaded.
 */
export interface TaskContext<T = any[]> {
  /**
   * A tuple with injected objects passed to the factory of the transformer.
   */
  factoryInjections: T;

  /**
   * The main build graph
   */
  graph: BuildGraph;

  context<Z extends NgPackagrBuilderTaskSchema = TData>(): NgPackagerHooksContext<Z>;

  taskArgs(key: string): string | undefined;
}

/**
 * A context for hook handlers running at the processing phase, where each entry point is being processed in a sequence, one after the other.
 */
export interface EntryPointTaskContext<T = any[]> extends TaskContext<T> {
  epNode: EntryPointNode;
}
```

> `EntryPointTaskContext` handlers are called multiple times, once for every package (primary and secondary). `TaskContext` is called once before starting to process packages

There are 2 types of tasks:

- A simple function (`HookHandler`)
- A typed task

The first is just a function that implements (`HookHandler`), best suited for ad-hoc quick tasks.

Typed tasks are more strict and organized, they usually require input and they also provide a schema to validate against that input. (see copy example below).

> The input for all typed tasks is always through `tasks.data` where each typed task has a "namespace" which is a property on the data object that points to it's own input object.

The library comes with several built in tasks (typed tasks).

You can review [the source code](/src/tasks) for some of the built-in typed tasks and build your own.

## Examples

Before we dive into examples, it's important that we understand what information is available to us, provided by `ng-packagr`.

Most of it is stored in `EntryPointNode`. The `EntryPointNode` object contains a lot of things. File path locations (sources, destinations), cached files, cache TS compiler programs and more...

If we want to copy or move files, delete, build something etc, we need to know where the resources are located...

There isn't much documentation, but [it is typed which should be enough](https://github.com/ng-packagr/ng-packagr/blob/master/src/lib/ng-v5/nodes.ts).

- [Filtering build of packages (custom task)](/examples/filter-packages)
- [Copy files and Bump version (built-in tasks)](/examples/copy-files-and-bump)
- [API Metadata generator](/examples/api-generator)
- [Modify TS compilation settings in secondary entry points](/examples/update-tsconfig-for-secondary-entry-points)

TODO:

- Example on information in `EntryPointNode` (destination, metadata etc...)
- Example for theme builder (e.g. scss)
