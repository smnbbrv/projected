# proxy-collections

Collections of objects that rely on remote data sources. Hides the complexity of fetching and caching data from a remote source.

## Installation

```bash
npm i proxy-collections
```

## SelectiveProxyMap

A collection of objects that are not stored in memory, but are fetched from a remote source when needed. This is useful when you have a large collection of objects that you don't want to load all at once.

- lazy: objects are obtained only when needed
- bundles all requests into a single request by the specified delay and chunk size
- cache: fetched objects can be stored in a cache

### Default (no cache)

```ts
import { SelectiveProxyMap } from 'proxy-collections';

type Value = {
  key: string;
  value: string;
};

const collection = new SelectiveProxyMap<string, Value>({
  key: 'key',
  // function that fetches the data from a remote source given a list of deduplicated grouped keys
  handle: async (keys) => {
    // here you would fetch the data from a remote source
    return keys.map((key) => ({ key, value: `Value for key ${key}` }));
  },
  // groups all requests in a single request within the last 10ms, but no more than 1000 requests per chunk
  delay: 10, 
  maxChunkSize: 1000, 
});

await collection.get('key1'); // Value for key key1
await collection.get(['key2', 'key3']); // Value for key key2
```

### With cache

You can opt to use a cache to store the fetched objects. The cache must implement type `ProxyMapCache`. This can be a normal js `Map`, [lru-cache](https://www.npmjs.com/package/lru-cache) or any similar cache implementation.

```ts
import { SelectiveProxyMap } from 'proxy-collections';

type Value = {
  key: string;
  value: string;
};

const collection = new SelectiveProxyMap<string, Value>({
  key: 'key',
  handle: async (keys) => {
    // here you would fetch the data from a remote source
    return keys.map((key) => ({ key, value: `Value for key ${key}` }));
  },
  cache: new Map(),
});

await collection.get('key1'); // Value for key key1
await collection.get(['key2', 'key3']); // Value for key key2
```
