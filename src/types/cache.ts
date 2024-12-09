import type { Maybe } from './maybe.js';

export type ProxyMapCache<K, T> = {
  has: (key: K) => boolean;
  get: (key: K) => Maybe<T>;
  set: (key: K, value: T) => void;
  delete: (key: K) => void;
  clear: () => void;
};
