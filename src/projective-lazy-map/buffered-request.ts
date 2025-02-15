import { firstValueFrom, Subject } from 'rxjs';

import type { Maybe } from '../types/maybe.js';

/**
 * FetchBufferedRequest is a class that collects and handles buffered requests logic
 */
export class BufferedRequest<K, T> {
  /**
   * Maps that contain mapped responses for each request
   */
  private readonly maps: Map<K, T>[] = [];

  /**
   * Set of keys that are not yet requested
   * Used to determine when all keys are requested
   */
  private readonly pendingKeys: Set<K>;

  /**
   * Subject that emits when all requests are completed
   * Used for conversion to promise-alike `ready` property
   */
  private readonly ready$ = new Subject<Maybe<T>[]>();

  /**
   * Promise that resolves when all entities are resolved
   */
  readonly ready: Promise<Maybe<T>[]>;

  /**
   * Number of pending requests
   * Used to determine when all requests are completed
   * and `ready` property can be resolved
   */
  private pendingRequests = 0;

  constructor(private readonly initialKeys: K[]) {
    this.pendingKeys = new Set(initialKeys);
    this.ready = firstValueFrom(this.ready$);
  }

  /**
   * Handles request and completes `ready` property when all entities are resolved
   * @param request Promise that resolves to a map of entities
   */
  async handleRequest(request: Promise<Map<K, T>>) {
    this.pendingRequests++;

    try {
      const map = await request;

      // save map to the list of maps
      this.maps.push(map);

      // remove amount of pending requests
      this.pendingRequests--;

      // if there are no pending requests and pending keys
      // then all entities are requested AND resolved
      // so we can consider the request as completed
      if (!this.pendingKeys.size && !this.pendingRequests) {
        // merge all maps into one
        const mergedMap = this.maps.reduce((map, m) => {
          m.forEach((item, key) => map.set(key, item));

          return map;
        }, new Map<K, T>());

        const resolved = this.initialKeys.map((key) => mergedMap.get(key));

        // emit ready event with resolved entities
        this.ready$.next(resolved);
      }
    } catch (e) {
      this.ready$.error(e);
    }
  }

  /**
   * Marks key as requested and removes it from pending keys
   * @param key Key to mark as requested
   */
  markAsRequested(key: K) {
    this.pendingKeys.delete(key);
  }
}
