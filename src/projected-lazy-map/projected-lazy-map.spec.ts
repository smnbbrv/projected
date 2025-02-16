import { describe, it, expect } from 'vitest';

import { createProjectedLazyMap, ProjectedLazyMap } from './projected-lazy-map.js';

const testData = [
  { id: '1', title: 'title1' },
  { id: '2', title: 'title2' },
  { id: '3', title: 'title3' },
  { id: '4', title: 'title4' },
  { id: '5', title: 'title5' },
];

type TestObject = (typeof testData)[0];

describe('fetcher', () => {
  it('should create map with createProjectedLazyMap', () => {
    const map = createProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: (ids) => testData.filter((item) => ids.includes(item.id)),
    });

    expect(map).toBeTruthy();
    expect(map).toBeInstanceOf(ProjectedLazyMap);
  });

  it('should fetch one', async () => {
    const map = new ProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: (ids) => testData.filter((item) => ids.includes(item.id)),
      delay: 1000,
    });

    expect(map).toBeTruthy();

    const res = await map.getByKey('3');

    expect(res).toBeTruthy();
    expect(res?.title).toBe('title3');
  });

  it('should fetch one (buffered)', async () => {
    const projectedMap = new ProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: async (ids) => testData.filter((item) => ids.includes(item.id)),
    });

    expect(projectedMap).toBeTruthy();

    const res = await projectedMap.getByKey('3');

    expect(res).toBeTruthy();
    expect(res?.title).toBe('title3');
  });

  it("shouldn't get many if keys array is empty", async () => {
    const projectedMap = new ProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: async (ids) => testData.filter((item) => ids.includes(item.id)),
    });

    expect(projectedMap).toBeTruthy();

    const res = await projectedMap.getByKeys([]);

    expect(res.length).toBe(0);
  });

  it('should fetch many', async () => {
    const projectedMap = new ProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: async (ids) => testData.filter((item) => ids.includes(item.id)),
    });

    expect(projectedMap).toBeTruthy();

    const res = await projectedMap.getByKeys(['4', '3', '5']);

    expect(res.length).toBe(3);

    expect(res[0]).toBeTruthy();
    expect(res[0]!.id).toBe('4');
    expect(res[0]!.title).toBe('title4');
    expect(res[1]).toBeTruthy();
    expect(res[1]!.id).toBe('3');
    expect(res[1]!.title).toBe('title3');
    expect(res[2]).toBeTruthy();
    expect(res[2]!.id).toBe('5');
    expect(res[2]!.title).toBe('title5');
  });

  it('should fetch many (buffered)', async () => {
    const projectedMap = new ProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: async (ids) => testData.filter((item) => ids.includes(item.id)),
    });

    expect(projectedMap).toBeTruthy();

    const res = await projectedMap.getByKeys(['4', '3', '5']);

    expect(res.length).toBe(3);

    expect(res[0]).toBeTruthy();
    expect(res[0]!.id).toBe('4');
    expect(res[0]!.title).toBe('title4');
    expect(res[1]).toBeTruthy();
    expect(res[1]!.id).toBe('3');
    expect(res[1]!.title).toBe('title3');
    expect(res[2]).toBeTruthy();
    expect(res[2]!.id).toBe('5');
    expect(res[2]!.title).toBe('title5');
  });

  it('should fetch many (buffered) with multiple parallel fetches', async () => {
    const delays = [500, 200];

    const projectedMap = new ProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: async (ids) => {
        const delay = delays.shift();

        await new Promise((resolve) => setTimeout(resolve, delay));

        return testData.filter((item) => ids.includes(item.id));
      },
      delay: 1000,
      maxChunkSize: 2,
    });

    expect(projectedMap).toBeTruthy();

    const [res1, res2] = await Promise.all([
      projectedMap.getByKeys(['4', '3', '5']),
      projectedMap.getByKeys(['2', '3', '1']),
    ]);

    expect(res1.length).toBe(3);

    expect(res1[0]).toBeTruthy();
    expect(res1[0]!.id).toBe('4');
    expect(res1[0]!.title).toBe('title4');
    expect(res1[1]).toBeTruthy();
    expect(res1[1]!.id).toBe('3');
    expect(res1[1]!.title).toBe('title3');
    expect(res1[2]).toBeTruthy();
    expect(res1[2]!.id).toBe('5');
    expect(res1[2]!.title).toBe('title5');

    expect(res2.length).toBe(3);

    expect(res2[0]).toBeTruthy();
    expect(res2[0]!.id).toBe('2');
    expect(res2[0]!.title).toBe('title2');
    expect(res2[1]).toBeTruthy();
    expect(res2[1]!.id).toBe('3');
    expect(res2[1]!.title).toBe('title3');
    expect(res2[2]).toBeTruthy();
    expect(res2[2]!.id).toBe('1');
    expect(res2[2]!.title).toBe('title1');
  });

  it('should return sparse arrays', async () => {
    const projectedMap = new ProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: async (ids) => testData.filter((item) => ids.includes(item.id)),
    });

    expect(projectedMap).toBeTruthy();

    const sparse = await projectedMap.getByKeysSparse(['4', '6', '5']);

    expect(sparse.length).toBe(3);

    expect(sparse[0]).toBeTruthy();
    expect(sparse[0]!.id).toBe('4');
    expect(sparse[0]!.title).toBe('title4');
    expect(sparse[1]).toBeUndefined();
    expect(sparse[2]).toBeTruthy();
    expect(sparse[2]!.id).toBe('5');
    expect(sparse[2]!.title).toBe('title5');

    const dense = await projectedMap.getByKeys(['4', '6', '5']);

    expect(dense.length).toBe(2);

    expect(dense[0]).toBeTruthy();
    expect(dense[0]!.id).toBe('4');
    expect(dense[0]!.title).toBe('title4');
    expect(dense[1]).toBeTruthy();
    expect(dense[1]!.id).toBe('5');
    expect(dense[1]!.title).toBe('title5');
  });

  it('should propagate errors', async () => {
    const projectedMap = new ProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: async (ids) => {
        throw new Error('fetch error ' + ids.join(','));
      },
    });

    expect(projectedMap).toBeTruthy();

    await expect(projectedMap.getByKey('3')).rejects.toThrow('fetch error 3');
    await expect(projectedMap.getByKeys(['3', '4'])).rejects.toThrow('fetch error 3,4');
  });

  it('should implement mixed get method', async () => {
    const projectedMap = new ProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: async (ids) => testData.filter((item) => ids.includes(item.id)),
    });

    const one = await projectedMap.get('3');
    const many = await projectedMap.get(['4', '6', '5']);

    expect(one).toBeTruthy();
    expect(one!.id).toBe('3');

    expect(many[0]).toBeTruthy();
    expect(many[0]!.id).toBe('4');
    expect(many[0]!.title).toBe('title4');
    expect(many[1]).toBeTruthy();
    expect(many[1]!.id).toBe('5');
    expect(many[1]!.title).toBe('title5');
  });
});

describe('cache', () => {
  it('should create a fully functional cache by default', async () => {
    const projectedMap = new ProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: async (ids) => testData.filter((item) => ids.includes(item.id)),
    });

    expect(projectedMap).toBeTruthy();

    const res = await projectedMap.getByKey('3');

    expect(res).toBeTruthy();
    expect(res?.title).toBe('title3');

    // expect(cache).toBeTruthy();

    // // because it's a noop cache
    // expect(cache.has('3')).toBeFalsy();
    // expect(cache.get('3')).toBeUndefined();
    // expect(() => cache.delete('3')).not.toThrow();
    // expect(() => cache.clear()).not.toThrow();
  });

  it('should use custom cache', async () => {
    const cache = new Map();

    const map = new ProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: (ids) => testData.filter((item) => ids.includes(item.id)),
      delay: 1000,
      cache,
    });

    expect(map).toBeTruthy();

    const res = await map.getByKey('3');

    expect(res).toBeTruthy();
    expect(res?.title).toBe('title3');

    expect(cache.has('3')).toBeTruthy();

    const res2 = await map.getByKey('3');

    expect(res2).toBeTruthy();
    expect(res2?.title).toBe('title3');

    cache.delete('3');

    expect(cache.has('3')).toBeFalsy();
    expect(cache.get('3')).toBeUndefined();

    const res3 = await map.getByKey('3');

    expect(res3).toBeTruthy();
    expect(res3?.title).toBe('title3');

    const res4 = await map.getByKeys(['3', '4', '5']);

    expect(res4.length).toBe(3);

    expect(res4[0]).toBeTruthy();
    expect(res4[0]!.id).toBe('3');
    expect(res4[0]!.title).toBe('title3');
    expect(res4[1]).toBeTruthy();
    expect(res4[1]!.id).toBe('4');
    expect(res4[1]!.title).toBe('title4');
    expect(res4[2]).toBeTruthy();
    expect(res4[2]!.id).toBe('5');
    expect(res4[2]!.title).toBe('title5');

    expect(cache.has('3')).toBeTruthy();
    expect(cache.has('4')).toBeTruthy();
    expect(cache.has('5')).toBeTruthy();
  });

  it('should not cache not found items', async () => {
    const cache = new Map();

    const map = new ProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: (ids) => testData.filter((item) => ids.includes(item.id)),
      delay: 1000,
      cache,
    });

    const many = await map.getByKeys(['3', '7', '6', '5']);

    expect(many.length).toBe(2);

    const one = await map.getByKey('8');

    expect(one).toBeUndefined();

    expect(cache.has('3')).toBeTruthy();
    expect(cache.has('5')).toBeTruthy();
    expect(cache.has('6')).toBeFalsy();
    expect(cache.has('7')).toBeFalsy();
    expect(cache.has('8')).toBeFalsy();
  });

  it('should not perform handle if all keys are found in cache', async () => {
    const map = new ProjectedLazyMap<string, TestObject>({
      key: (item) => item.id,
      values: (ids) => testData.filter((item) => ids.includes(item.id)),
      delay: 1000,
      cache: new Map(),
    });

    const cacheMissed = await map.getByKeys(['3', '4', '5']);

    expect(cacheMissed.length).toBe(3);

    const cacheHits = await map.getByKeys(['3', '4', '5']);

    expect(cacheHits.length).toBe(3);
  });
});
