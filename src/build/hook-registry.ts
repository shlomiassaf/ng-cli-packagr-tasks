import { TaskPhases, NgPackagerHooks, NormalizedNgPackagerHooks } from './hooks';
import { normalizeHooks, normalizeTaskPhases, HOOK_PHASES, TRANSFORM_PROVIDER_MAP } from './utils';
import { JobMetadata, findJobMetadata, Type } from './job';

export class HookRegistry {
  private _jobs: JobMetadata[] = [];
  private _hooks: NormalizedNgPackagerHooks = {};

  get hasSelfWatchJob(): boolean {
    return this._jobs.some( job => job.internalWatch )
  }

  constructor(initialHooks?: NgPackagerHooks) {
    if (initialHooks) {
      this._hooks = normalizeHooks(initialHooks);
    }    
  }

  register<T>(job: Type<T>): this;
  register<T extends keyof NgPackagerHooks>(hook: T, handlers: NgPackagerHooks[T]): this;
  register<T extends keyof NgPackagerHooks>(hookOrJob: T | Type, handlers?: NgPackagerHooks[T]): this {
    if (typeof hookOrJob === 'string') {
      const taskPhases = normalizeTaskPhases(handlers);
      for (const phase of HOOK_PHASES) {
        const handlers = taskPhases[phase];
        if (handlers) {
          this.getHookPhase(hookOrJob, phase).push(...handlers)
        }
      }
    } else {
      const jobMeta = findJobMetadata(hookOrJob);
      if (!jobMeta) {
        throw new Error(`Unknown Job: ${hookOrJob}`);
      }
      this._jobs.push(jobMeta);
      const { hooks }= jobMeta;
      const hookNames: Array<keyof NgPackagerHooks> = Object.keys(TRANSFORM_PROVIDER_MAP) as any;

      for (const key of hookNames) {
        if (hooks[key]) {
          this.register(key, hooks[key]);
        }
      }
    }
    return this;
  }

  getHooks(): NormalizedNgPackagerHooks {
    return this._hooks;
  }

  getJobs(): JobMetadata[] {
    return this._jobs;
  }

  private getHookPhase<T extends keyof NgPackagerHooks, P extends keyof TaskPhases>(hook: T, phase: P): NormalizedNgPackagerHooks[T][P] {
    const hookMap = this._hooks[hook] || (this._hooks[hook] = {});

    if (!hookMap[phase]) {
      hookMap[phase] = [] as NormalizedNgPackagerHooks[T][P];
    }

    return hookMap[phase]
  }
}