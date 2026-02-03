import type { MaybePromise } from '../types/maybe-promise.js';
import type { Maybe } from '../types/maybe.js';
import type { Protection } from '../types/protection.js';
import { deepFreeze } from '../utils/deep-freeze.js';

type CacheState<V> =
  | { status: 'empty' }
  | { status: 'pending'; promise: Promise<V> }
  | { status: 'resolved'; value: V }
  | { status: 'refreshing'; value: V; promise: Promise<V> };

export type ProjectedValueOptions<V> = {
  /**
   * Function that fetches a value
   * @returns Promise that resolves to a value
   */
  value: () => MaybePromise<V>;

  /**
   * Should the value be protected from modification
   * - 'freeze' - values are deeply frozen
   * - 'none' - values are not protected
   * @default 'none'
   */
  protection?: Maybe<Protection>;

  /**
   * Cache implementation (optional)
   * - false - no cache
   * - true - use default cache
   * @default true
   */
  cache?: boolean;
};

/**
 * A value being fetched from a remote source on demand.
 * This is useful when you have a single value that is expensive to fetch and you want to fetch it only when it is needed.
 */
export class ProjectedValue<V> {
  private _state: CacheState<V> = { status: 'empty' };
  private readonly valueFn: ProjectedValueOptions<V>['value'];
  private readonly protection: Maybe<Protection>;
  private readonly shouldCache: boolean;

  constructor({ value, protection, cache }: ProjectedValueOptions<V>) {
    this.valueFn = value;
    this.protection = protection ?? 'none';
    this.shouldCache = cache ?? true;
  }

  /**
   * Get the value
   * @returns Value (sync if cached) or Promise that resolves to a value (async if fetching)
   */
  get(): MaybePromise<V> {
    const state = this._state;

    // cache hit - return sync
    if (state.status === 'resolved' || state.status === 'refreshing') {
      return state.value;
    }

    // already fetching - return existing promise
    if (state.status === 'pending') {
      return state.promise;
    }

    // cache miss - fetch
    return this.fetch();
  }

  /**
   * Clear the value, so it will be fetched again on the next access
   * @returns void
   */
  clear() {
    this._state = { status: 'empty' };
  }

  /**
   * Refresh the value using stale-while-revalidate pattern.
   * - Returns the current cached value immediately (if exists)
   * - Triggers a background refresh
   * - Replaces cached value only when refresh succeeds
   * - On refresh error, keeps serving the stale value
   * @returns Current cached value, or undefined if no value is cached (always sync)
   */
  refresh(): Maybe<V> {
    const state = this._state;

    // already refreshing - return stale value
    if (state.status === 'refreshing') {
      return state.value;
    }

    // nothing cached or still pending - return undefined
    if (state.status === 'empty' || state.status === 'pending') {
      this.triggerBackgroundRefresh(undefined);

      return undefined;
    }

    // have cached value - trigger refresh and return stale
    const staleValue = state.value;

    this.triggerBackgroundRefresh(staleValue);

    return staleValue;
  }

  private fetch(): Promise<V> {
    const promise = Promise.resolve()
      .then(() => this.valueFn())
      .then((v) => {
        const value = this.protection === 'freeze' ? deepFreeze(v) : v;

        if (this.shouldCache) {
          this._state = { status: 'resolved', value };
        } else {
          this._state = { status: 'empty' };
        }

        return value;
      })
      .catch((err) => {
        this._state = { status: 'empty' };

        throw err;
      });

    this._state = { status: 'pending', promise };

    return promise;
  }

  private triggerBackgroundRefresh(staleValue: V | undefined) {
    const promise = Promise.resolve()
      .then(() => this.valueFn())
      .then((v) => {
        const value = this.protection === 'freeze' ? deepFreeze(v) : v;

        if (this.shouldCache) {
          this._state = { status: 'resolved', value };
        } else {
          this._state = { status: 'empty' };
        }

        return value;
      })
      .catch(() => {
        // on error, keep stale value if we have one
        if (staleValue !== undefined && this.shouldCache) {
          this._state = { status: 'resolved', value: staleValue };
        } else {
          this._state = { status: 'empty' };
        }
      });

    if (staleValue !== undefined) {
      this._state = { status: 'refreshing', value: staleValue, promise: promise as Promise<V> };
    } else {
      this._state = { status: 'pending', promise: promise as Promise<V> };
    }
  }
}

export const createProjectedValue = <V>(options: ProjectedValueOptions<V>) => new ProjectedValue(options);
