import type { ProjectedMapCache } from '../types/cache.js';
import type { Maybe } from '../types/maybe.js';
import { defined } from '../utils/defined.js';
import { NOOP_CACHE } from '../utils/noop-cache.js';

import { type FetcherOptions, Fetcher } from './fetcher.js';

export type ProjectedLazyMapOptions<K, V> = FetcherOptions<K, V> & {
  /**
   * Cache implementation (optional)
   */
  cache?: ProjectedMapCache<K, V>;
};

interface GetOptions {
  immediate?: boolean;
}

/**
 * A collection of objects that are not stored in memory, but are fetched from a remote source when needed.
 * This is useful when you have a large collection of objects that you don't want to load all at once.
 */
export class ProjectedLazyMap<K, V> {
  private readonly cache: ProjectedMapCache<K, V>;
  private readonly fetcher: Fetcher<K, V>;
  private readonly key: FetcherOptions<K, V>['key'];

  constructor({ cache, key, ...fetcherOptions }: ProjectedLazyMapOptions<K, V>) {
    this.key = key;
    this.fetcher = new Fetcher({ key, ...fetcherOptions });
    this.cache = cache ?? NOOP_CACHE;
  }

  async getByKeysSparse(keys: K[], options?: GetOptions): Promise<Maybe<V>[]> {
    if (!keys.length) {
      return [];
    }

    const hits = keys.map((id) => this.cache.get(id)).filter(defined);
    const foundMap = new Map(hits.map((value) => [this.key(value), value]));
    const missingKeys = keys.filter((id) => !foundMap.has(id));

    if (!missingKeys.length) {
      return hits;
    }

    const missing = await this.fetcher.fetchMany(keys, options);

    missing.filter(defined).forEach((value) => {
      foundMap.set(this.key(value), value);
      this.cache.set(this.key(value), value);
    });

    return keys.map((id) => foundMap.get(id));
  }

  /**
   * Fetch many values by keys
   * @param keys Array of keys
   * @param options Fetch options
   * @returns Promise that resolves to an array of values
   */
  async getByKeys(keys: K[], options?: GetOptions): Promise<V[]> {
    return (await this.getByKeysSparse(keys, options)).filter(defined);
  }

  /**
   * Get value by key
   * @param key Key
   * @param options Fetch options
   * @returns Promise that resolves to a value
   */
  async getByKey(key: K, options?: GetOptions): Promise<Maybe<V>> {
    const hit = this.cache.get(key);

    if (hit) {
      return hit;
    }

    const fetched = await this.fetcher.fetchOne(key, options);

    if (fetched) {
      this.cache.set(key, fetched);
    }

    return fetched;
  }

  async get(keyOrKeys: K[], options?: GetOptions): Promise<V[]>;
  async get(keyOrKeys: K, options?: GetOptions): Promise<Maybe<V>>;

  /**
   * Mixed get method
   * @param keyOrKeys Key or array of keys
   * @param options Fetch options
   * @returns Promise that resolves to a value or an array of values depending on the input
   */
  async get(keyOrKeys: K | K[], options?: GetOptions): Promise<V[] | Maybe<V>> {
    if (Array.isArray(keyOrKeys)) {
      return this.getByKeys(keyOrKeys, options);
    }

    return this.getByKey(keyOrKeys, options);
  }

  /**
   * Delete value by key
   * @param key Key
   * @param value Value
   * @returns void
   */
  async delete(keyOrKeys: K | K[]) {
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
  async clear() {
    this.cache.clear();
  }
}

export const createProjectedLazyMap = <K, V>(options: ProjectedLazyMapOptions<K, V>) => new ProjectedLazyMap(options);
