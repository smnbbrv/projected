# projected

Collections of utilities. Hides the complexity of fetching and caching data from a remote source regardless of the number of consumers.

## Installation

```bash
npm i projected
```

## ProjectedValue

A single value that is stored in memory, but being fetched from a remote source on demand. This is useful when you have a single object that you need to fetch and actualize from the remote data source.

- lazy: object is obtained only when needed
- all consumers are re-using the same connection, which means only one call is issued regardless of the number of consumers

```ts
import { ProjectedValue } from 'projected';

type Value = {
  key: string;
  value: string;
};

const value = new ProjectedValue<Value>({
  // function that fetches the data from a remote source
  value: async () => {
    // here you would fetch the data from a remote source
    return { key: 'key1', value: 'Value for key key1' };
  },
});

await value.get(); // Value
```

## ProjectedMap

A collection of objects that are stored in memory, but being fetched from a remote source on demand. This is useful when you have a fairly small collection of objects that you need to fetch and actualize from the remote data source.

- lazy: objects are obtained only when needed
- provides a way to get all items as array or map
- all items are cached until the collection is cleared
- all consumers are re-using the same connection, which means only one call is issued regardless of the number of consumers
  
```ts
import { ProjectedMap } from 'projected';

type Value = {
  key: string;
  value: string;
};

const collection = new ProjectedMap<string, Value>({
  key: 'key',
  // function that fetches the data from a remote source
  values: async () => {
    // here you would fetch the data from a remote source
    return Array.from({ length: 10 }, (_, i) => ({ key: `key${i}`, value: `Value for key key${i}` }));
  },
});

await collection.getAll(); // Array of all items
await collection.get('key1'); // Value for key key1
await collection.get(['key2', 'key3']); // Value for key2, key3
```


## ProjectedLazyMap

A collection of objects that are not stored in memory, but are fetched from a remote source when needed. This is useful when you have a large collection of objects that you don't want to load all at once.

- lazy: objects are obtained only when needed
- bundles all requests into a single request by the specified delay and chunk size
- cache: fetched objects can be stored in a cache

### Default (no cache)

```ts
import { ProjectedLazyMap } from 'projected';

type Value = {
  key: string;
  value: string;
};

const collection = new ProjectedLazyMap<string, Value>({
  key: 'key',
  // function that fetches the data from a remote source given a list of deduplicated grouped keys
  values: async (keys) => {
    // here you would fetch the data from a remote source
    return keys.map((key) => ({ key, value: `Value for key ${key}` }));
  },
  // groups all requests in a single request within the last 10ms, but no more than 1000 requests per chunk
  delay: 10, 
  maxChunkSize: 1000, 
});

await collection.get('key1'); // Value for key key1
await collection.get(['key2', 'key3']); // Value for key2, key3
```

### With cache

You can opt to use a cache to store the fetched objects. The cache must implement type `ProjectedMapCache`. This can be a normal js `Map`, [lru-cache](https://www.npmjs.com/package/lru-cache) or any similar cache implementation.

```ts
import { ProjectedLazyMap } from 'projected';

type Value = {
  key: string;
  value: string;
};

const collection = new ProjectedLazyMap<string, Value>({
  key: 'key',
  values: async (keys) => {
    // here you would fetch the data from a remote source
    return keys.map((key) => ({ key, value: `Value for key ${key}` }));
  },
  cache: new Map(),
});

await collection.get('key1'); // Value for key key1
await collection.get(['key2', 'key3']); // Value for key2, key3
```

## License

[MIT](LICENSE.md)
