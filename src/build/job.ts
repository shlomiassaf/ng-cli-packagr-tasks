import { NgPackagerHooks } from './hooks';

const store = new WeakMap<Type, JobMetadata>();

export interface Type<T = any> extends Function {
  new (...args: any[]): T
}

export interface JobMetadata {
  schema: string;
  selector: string;
  hooks: NgPackagerHooks;
}

export function findJobMetadata(type: Type): JobMetadata | undefined {
  return store.get(type);
}

export function Job(metadata: JobMetadata) {
  return target => {
    store.set(target, metadata);
  };
}
