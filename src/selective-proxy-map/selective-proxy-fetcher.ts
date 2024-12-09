import type { Observable } from 'rxjs';
import { Subject, bufferTime, share, filter, map } from 'rxjs';

import type { MaybePromise } from '../types/maybe-promise.js';
import type { Maybe } from '../types/maybe.js';
import { deepFreeze } from '../utils/deep-freeze.js';
import { defined } from '../utils/defined.js';

import { BufferedRequest } from './buffered-request.js';

/**
 * ProxyMap is a utility class that helps to reduce the number of requests to the backend.
 */
export type SelectiveProxyFetcherOptions<K, V> = {
  /**
   * Function that returns key of an entity
   * If not provided, the entity is expected to have `key` property
   * @param item Entity
   * @returns Key of the entity
   */
  key: (item: V) => K;

  /**
   * Function that fetches multiple entities by keys
   * @param keys Array of keys
   * @returns Promise that resolves to an array of entities
   */
  values: (keys: K[]) => MaybePromise<Maybe<V>[]>;

  /**
   * Delay in ms that is used to buffer requests
   * @default 100
   */
  delay?: number;

  /**
   * Maximum number of keys that can be buffered
   * @default 1000
   */
  maxChunkSize?: number;
};

interface FetchOptions {
  immediate?: boolean;
}

export type FetchManyOptions = FetchOptions;
export type FetchOneOptions = FetchOptions;

/**
 * ProxyMap is a utility class that helps to reduce the number of requests to the backend.
 */
export class SelectiveProxyFetcher<K, V> {
  private readonly incomingRequests: Subject<{ key: K; bufferedRequest: BufferedRequest<K, V> }> = new Subject();
  private readonly bufferedRequests: Observable<void>;
  private readonly handle: (keys: K[]) => MaybePromise<Maybe<V>[]>;
  private readonly key: (item: V) => K;
  private readonly delay: number;
  private readonly bufferMaxSize: number;

  constructor(options: SelectiveProxyFetcherOptions<K, V>) {
    // setting default values
    const { values: handle, key, delay, maxChunkSize: bufferMaxSize } = options;

    this.handle = handle;
    this.key = key;
    this.delay = delay ?? 100;
    this.bufferMaxSize = bufferMaxSize ?? 1000;

    // listening to incoming requests and buffering them
    this.bufferedRequests = this.incomingRequests.pipe(
      // collects requests for a certain amount of time and count
      // and emits them as an array
      // here it can happen that the BufferedRequests are split and emitted as multiple arrays / events
      // that's why we must keep track of them using BufferedRequest.pendingKeys and BufferedRequest.pendingRequests
      bufferTime(this.delay, null, this.bufferMaxSize),
      // filters out empty arrays (just in case)
      filter((requests) => !!requests.length),
      // actually primary logic of the class
      // we use map here because we do not want to subscribe to the observable
      // and let the buffered request do it
      // otherwise the observable produces ticks with empty arrays that can impact performance
      map((requests) => {
        const bufferedRequests = new Set<BufferedRequest<K, V>>();
        const keys = new Set<K>();

        // find requests and keys that we bundle in one fetch later
        // also mark each requested key as requested by the buffered request
        requests.forEach(({ bufferedRequest, key }) => {
          bufferedRequests.add(bufferedRequest);
          keys.add(key);
          bufferedRequest.markAsRequested(key);
        });

        // create a request that will be used to fetch a bundle of entities
        // then create a map of entities
        const request = Promise.resolve(this.handle([...keys])).then((items) => this.createMap(items.map(deepFreeze)));

        // each buffered request handles the bundled request response on its own
        bufferedRequests.forEach((bag) => bag.handleRequest(request));
      }),
      // each caller receives the same observable (avoid duplicate bundle requests)
      share(),
    );
  }

  /**
   * Fetch many entities by keys
   * @param keys Array of keys
   * @param buffered If true, the request will be buffered and the result will potentially be delayed but the overall number of requests will be reduced
   * @returns Promise that resolves to an array of entities
   */
  async fetchMany(keys: K[], options?: FetchManyOptions): Promise<Maybe<V>[]> {
    const immediate = options?.immediate ?? false;

    if (!immediate) {
      return this.fetchBuffered(keys);
    }

    return this.fetchNow(keys);
  }

  /**
   * Fetch one entity by key
   * @param key Key of the entity
   * @param buffered If true, the request will be buffered and the result will potentially be delayed but the overall number of requests will be reduced
   * @returns Promise that resolves to an entity
   */
  async fetchOne(key: K, options?: FetchOneOptions): Promise<Maybe<V>> {
    const immediate = options?.immediate ?? false;

    const result = await (!immediate ? this.fetchBuffered([key]) : this.fetchNow([key]));

    return result[0];
  }

  /**
   * Implements buffered requests logic
   * @param keys Array of keys
   * @returns Promise that resolves to an array of entities
   */
  private async fetchBuffered(keys: K[]): Promise<Maybe<V>[]> {
    // create buffered request
    const bufferedRequest = new BufferedRequest<K, V>(keys);

    // subscribe to buffered requests observable to enable its logic
    // if we do not subscribe, the observable will not emit anything
    const sub = this.bufferedRequests.subscribe();

    // send incoming request to the observable with each requested key mapped to the buffered request
    keys.forEach((key) => this.incomingRequests.next({ key, bufferedRequest }));

    // unsubscribe from the observable when the request is ready
    // that the observable can stop if there are no more requests
    return bufferedRequest.ready.finally(() => sub.unsubscribe()) as Promise<Maybe<V>[]>;
  }

  /**
   * Fetches entities by keys without buffering / delay
   * @param keys Array of keys
   * @returns Promise that resolves to an array of entities
   */
  private async fetchNow(keys: K[]): Promise<Maybe<V>[]> {
    const map = this.createMap(await this.handle(keys));

    return keys.map((key) => map.get(key));
  }

  private createMap(items: Maybe<V>[]) {
    return new Map<K, V>(items.filter(defined).map((item) => [this.key(item), item]));
  }
}
