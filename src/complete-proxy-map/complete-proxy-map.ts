import type { MaybePromise } from '../types/maybe-promise.js';
import type { Maybe } from '../types/maybe.js';
import { deepFreeze } from '../utils/deep-freeze.js';
import { defined } from '../utils/defined.js';

/**
 * ProxyMap is a utility class that helps to reduce the number of requests to the backend.
 */
export type CompleteProxyMapOptions<K, V> = {
  /**
   * Function that returns key of an entity
   * If not provided, the entity is expected to have `key` property
   * @param item Entity
   * @returns Key of the entity
   */
  key: (item: V) => K;

  /**
   * Function that fetches all entities
   * @param keys Array of keys
   * @returns Promise that resolves to an array of entities
   */
  values: () => MaybePromise<V[]>;
};

/**
 * ProxyMap is a utility class that helps to reduce the number of requests to the backend.
 */
export class CompleteProxyMap<K, V> {
  private _cache: Promise<Map<K, V>> | undefined;
  private readonly key: (item: V) => K;
  private readonly values: CompleteProxyMapOptions<K, V>['values'];

  constructor({ key, values }: CompleteProxyMapOptions<K, V>) {
    this.key = key;
    this.values = values;
  }

  async getAllAsMap(): Promise<Map<K, V>> {
    return new Map(await this.cache);
  }

  async getAll(): Promise<V[]> {
    return [...(await this.cache).values()];
  }

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
   * Clear cache
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

export const createCompleteProxyMap = <K, V>(options: CompleteProxyMapOptions<K, V>) => new CompleteProxyMap(options);
