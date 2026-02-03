import type { MaybePromise } from '../types/maybe-promise.js';
import type { Maybe } from '../types/maybe.js';
import type { Protection } from '../types/protection.js';
import { deepFreeze } from '../utils/deep-freeze.js';

type RefreshState<V> = {
  promise: Promise<V>;
  stale: Promise<V> | undefined;
};

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
  private _value: Promise<V> | undefined;
  private _refresh: RefreshState<V> | undefined;
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
   * @returns Promise that resolves to a value
   */
  async get(): Promise<V> {
    return this.value;
  }

  /**
   * Clear the value, so it will be fetched again on the next access
   * @returns void
   */
  clear() {
    this._value = undefined;
  }

  /**
   * Refresh the value using stale-while-revalidate pattern.
   * - Returns the current cached value immediately (if exists)
   * - Triggers a background refresh
   * - Replaces cached value only when refresh succeeds
   * - On refresh error, keeps serving the stale value
   * @returns Promise that resolves to the current cached value, or undefined if no value is cached
   */
  refresh(): Promise<Maybe<V>> {
    // if refresh already in progress, return its stale value
    if (this._refresh) {
      return this._refresh.stale?.catch(() => undefined) ?? Promise.resolve(undefined);
    }

    const stale = this._value;

    // start background refresh
    const promise = Promise.resolve()
      .then(() => this.valueFn())
      .then((v) => {
        if (v === undefined) {
          throw new Error('Return value "undefined" is not allowed in ProjectedValue');
        }

        const value = this.protection === 'freeze' ? deepFreeze(v) : v;

        // only update cache if we should cache
        if (this.shouldCache) {
          this._value = Promise.resolve(value);
        }

        return value;
      })
      .catch(() => {
        // on error, keep stale value - don't update cache
      })
      .finally(() => {
        this._refresh = undefined;
      });

    this._refresh = { promise: promise as Promise<V>, stale };

    // return stale value immediately, or undefined if nothing cached
    return stale?.catch(() => undefined) ?? Promise.resolve(undefined);
  }

  private get value() {
    if (!this._value) {
      this._value = Promise.resolve(this.valueFn())
        .then((v) => {
          if (v === undefined) {
            throw new Error('Return value "undefined" is not allowed in ProjectedValue');
          }

          return this.protection === 'freeze' ? deepFreeze(v) : v;
        })
        .catch((err) => {
          this.clear();
          throw err;
        })
        .finally(() => {
          if (!this.shouldCache) {
            setTimeout(() => {
              this.clear();
            });
          }
        });
    }

    return this._value;
  }
}

export const createProjectedValue = <V>(options: ProjectedValueOptions<V>) => new ProjectedValue(options);
