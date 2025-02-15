import type { ProjectedMapCache } from '../types/cache.js';

export const NOOP_CACHE = {
  has: () => false,
  get: () => undefined,
  set: () => undefined,
  delete: () => undefined,
  clear: () => undefined,
} as ProjectedMapCache<any, any>;
