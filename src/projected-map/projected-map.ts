import type { MaybePromise } from '../types/maybe-promise.js';
import type { Maybe } from '../types/maybe.js';
import { deepFreeze } from '../utils/deep-freeze.js';
import { defined } from '../utils/defined.js';

export type ProjectedMapOptions<K, V> = {
  /**
   * Function that returns key of an entity
   * If not provided, the entity is expected to have `key` property
   * @param item Entity
   * @returns Key of the entity
   */
  key: (item: V) => K;

  /**
   * Function that fetches all entities
   * @returns Promise that resolves to an array of entities
   */
  values: () => MaybePromise<V[]>;
};

/**
 * A collection of objects that are stored in memory, but being fetched from a remote source on demand.
 * This is useful when you have a fairly small collection of objects that you need to fetch and actualize from the remote data source.
 */
export class ProjectedMap<K, V> {
  private _cache: Promise<Map<K, V>> | undefined;
  private readonly key: (item: V) => K;
  private readonly values: ProjectedMapOptions<K, V>['values'];

  constructor({ key, values }: ProjectedMapOptions<K, V>) {
    this.key = key;
    this.values = values;
  }

  /**
   * Get all values as a map
   * @returns Promise that resolves to a map of all values
   */
  async getAllAsMap(): Promise<Map<K, V>> {
    return new Map(await this.cache);
  }

  /**
   * Get all values as an array (the order is preserved)
   * @returns Promise that resolves to an array of keys
   */
  async getAll(): Promise<V[]> {
    return [...(await this.cache).values()];
  }

  /**
   * Get values by keys, but return `undefined` for missing keys
   * @param keys Array of keys
   * @returns Promise that resolves to an array of values
   */
  async getByKeysSparse(keys: K[]): Promise<Maybe<V>[]> {
    if (!keys.length) {
      return [];
    }

    const cache = await this.cache;

    return keys.map((id) => cache.get(id));
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
    return (await this.cache).get(key);
  }

  async get(keyOrKeys: K[]): Promise<V[]>;
  async get(keyOrKeys: K): Promise<Maybe<V>>;

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
   * Clear the values, so they will be fetched again on the next access
   * @returns void
   */
  async clear() {
    this._cache = undefined;
  }

  private get cache() {
    if (!this._cache) {
      this._cache = Promise.resolve(this.values())
        .then((array) => array.reduce((map, item) => map.set(this.key(item), deepFreeze(item)), new Map()))
        .catch((err) => {
          this.clear();
          throw err;
        });
    }

    return this._cache;
  }
}

export const createProjectedMap = <K, V>(options: ProjectedMapOptions<K, V>) => new ProjectedMap(options);
