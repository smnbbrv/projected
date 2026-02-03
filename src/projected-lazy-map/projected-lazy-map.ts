import type { ProjectedMapCache } from '../types/cache.js';
import type { Maybe } from '../types/maybe.js';
import type { Protection } from '../types/protection.js';
import { deepFreeze } from '../utils/deep-freeze.js';
import { defined } from '../utils/defined.js';
import { NOOP_CACHE } from '../utils/noop-cache.js';

import { type ResolverOptions, Resolver } from './dispatcher.js';

export type ProjectedLazyMapOptions<K, V> = ResolverOptions<K, V> & {
  /**
   * Cache implementation (optional)
   * - false - no cache
   * - true - use default cache (`new Map()`)
   * - custom cache implementation
   * @default true
   */
  cache?: boolean | ProjectedMapCache<K, V>;

  /**
   * Should the values be protected from modification
   * - 'freeze' - values are deeply frozen
   * - 'none' - values are not protected
   * @default 'none'
   */
  protection?: Maybe<Protection>;
};

interface GetOptions {
  immediate?: boolean;
}

/**
 * A collection of objects that are not stored in memory, but are fetched from a remote source when needed.
 * This is useful when you have a large collection of objects that you don't want to load all at once.
 */
export class ProjectedLazyMap<K, V> {
  private readonly cache: ProjectedMapCache<K, V> = new Map();
  private readonly fetcher: Resolver<K, V>;
  private readonly key: ResolverOptions<K, V>['key'];
  private readonly protection: Maybe<Protection>;

  constructor({ cache, key, protection, ...fetcherOptions }: ProjectedLazyMapOptions<K, V>) {
    this.key = key;
    this.fetcher = new Resolver({ key, ...fetcherOptions });
    this.protection = protection ?? 'none';

    if (cache === false) {
      this.cache = NOOP_CACHE;
    } else if (typeof cache === 'object') {
      this.cache = cache;
    }
  }

  async getByKeysSparse(keys: K[]): Promise<Maybe<V>[]> {
    if (!keys.length) {
      return [];
    }

    const hits = keys.map((id) => this.cache.get(id)).filter(defined);
    const foundMap = new Map(hits.map((value) => [this.key(value), value]));
    const missingKeys = keys.filter((id) => !foundMap.has(id));

    if (!missingKeys.length) {
      return hits;
    }

    const missing = await this.fetcher.resolve(keys);

    missing.forEach((value) => {
      if (!value) {
        return;
      }

      if (this.protection === 'freeze') {
        deepFreeze(value);
      }

      foundMap.set(this.key(value), value);
      this.cache.set(this.key(value), value);
    });

    return keys.map((id) => foundMap.get(id));
  }

  /**
   * Fetch many values by keys
   * @param keys Array of keys
   * @returns Promise that resolves to an array of values
   */
  async getByKeys(keys: K[]): Promise<V[]> {
    return (await this.getByKeysSparse(keys)).filter(defined);
  }

  /**
   * Get value by key
   * @param key Key
   * @returns Promise that resolves to a value
   */
  async getByKey(key: K): Promise<Maybe<V>> {
    const hit = this.cache.get(key);

    if (hit) {
      return hit;
    }

    const [value] = await this.getByKeysSparse([key]);

    if (value) {
      this.cache.set(key, value);
    }

    return value;
  }

  async get(keyOrKeys: K[], options?: GetOptions): Promise<V[]>;
  async get(keyOrKeys: K, options?: GetOptions): Promise<Maybe<V>>;

  /**
   * Mixed get method
   * @param keyOrKeys Key or array of keys
   * @returns Promise that resolves to a value or an array of values depending on the input
   */
  async get(keyOrKeys: K | K[]): Promise<V[] | Maybe<V>> {
    if (Array.isArray(keyOrKeys)) {
      return this.getByKeys(keyOrKeys);
    }

    return this.getByKey(keyOrKeys);
  }

  /**
   * Delete value by key
   * @param key Key
   * @param value Value
   * @returns void
   */
  delete(keyOrKeys: K | K[]) {
    if (Array.isArray(keyOrKeys)) {
      keyOrKeys.forEach((key) => this.cache.delete(key));

      return;
    }

    this.cache.delete(keyOrKeys);
  }

  /**
   * Clear cache
   * @returns void
   */
  clear() {
    this.cache.clear();
  }

  refresh(key: K): Promise<Maybe<V>>;
  refresh(keys: K[]): Promise<Maybe<V>[]>;

  /**
   * Refresh value(s) using stale-while-revalidate pattern.
   * - Returns the current cached value(s) immediately
   * - Triggers a background refresh for the specified key(s)
   * - Updates cache entries only when refresh succeeds
   * - On refresh error, keeps serving the stale values
   * @param keyOrKeys Key or array of keys to refresh
   * @returns Promise that resolves to the current cached value(s)
   */
  refresh(keyOrKeys: K | K[]): Promise<Maybe<V> | Maybe<V>[]> {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    const staleValues = keys.map((key) => this.cache.get(key));

    // trigger background refresh
    this.fetcher
      .resolve(keys)
      .then((values) => {
        values.forEach((value) => {
          if (!value) {
            return;
          }

          if (this.protection === 'freeze') {
            deepFreeze(value);
          }

          this.cache.set(this.key(value), value);
        });
      })
      .catch(() => {
        // on error, keep stale values - don't update cache
      });

    // return stale values immediately
    if (Array.isArray(keyOrKeys)) {
      return Promise.resolve(staleValues);
    }

    return Promise.resolve(staleValues[0]);
  }
}

export const createProjectedLazyMap = <K, V>(options: ProjectedLazyMapOptions<K, V>) => new ProjectedLazyMap(options);
