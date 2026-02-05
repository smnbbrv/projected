import type { MaybePromise } from '../types/maybe-promise.js';

/**
 * Chains a transformation on a MaybePromise value.
 * If the value is a Promise, uses .then(). Otherwise, calls fn directly.
 *
 * @example
 * ```ts
 * const result = maybeThen(map.get('key'), (value) => value.name);
 * // result is MaybePromise<string>
 * ```
 */
export function maybeThen<T, R>(value: MaybePromise<T>, fn: (v: T) => MaybePromise<R>): MaybePromise<R> {
  if (value instanceof Promise) {
    return value.then(fn);
  }

  return fn(value);
}

/**
 * Adds error handling to a MaybePromise value.
 * If the value is a Promise, uses .catch(). Otherwise, returns value as-is.
 *
 * @example
 * ```ts
 * const result = maybeCatch(map.get('key'), (err) => defaultValue);
 * // result is MaybePromise<T>
 * ```
 */
export function maybeCatch<T>(value: MaybePromise<T>, fn: (e: unknown) => MaybePromise<T>): MaybePromise<T> {
  if (value instanceof Promise) {
    return value.catch(fn);
  }

  return value;
}
