import { it, expect, describe, vi } from 'vitest';

import { createProjectedMap, ProjectedMap } from './projected-map.js';

const testData = [
  { id: '1', title: 'title1' },
  { id: '2', title: 'title2' },
  { id: '3', title: 'title3' },
  { id: '4', title: 'title4' },
  { id: '5', title: 'title5' },
];

type TestObject = (typeof testData)[0];

it('should create map with createProjectedMap', () => {
  const map = createProjectedMap<string, TestObject>({
    key: (item) => item.id,
    values: () => testData,
  });

  expect(map).toBeTruthy();
  expect(map).toBeInstanceOf(ProjectedMap);
});

it('should fetch one', async () => {
  const map = new ProjectedMap<string, TestObject>({
    key: (item) => item.id,
    values: () => testData,
  });

  expect(map).toBeTruthy();

  const res = await map.getByKey('3');

  expect(res).toBeTruthy();
  expect(res?.title).toBe('title3');
});

it("shouldn't get many if keys array is empty", async () => {
  const projectedMap = new ProjectedMap<string, TestObject>({
    key: (item) => item.id,
    values: () => Promise.resolve(testData),
  });

  expect(projectedMap).toBeTruthy();

  const res = await projectedMap.getByKeys([]);

  expect(res.length).toBe(0);
});

it('should fetch many', async () => {
  const projectedMap = new ProjectedMap<string, TestObject>({
    key: (item) => item.id,
    values: () => Promise.resolve(testData),
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

it('should return sparse arrays', async () => {
  const projectedMap = new ProjectedMap<string, TestObject>({
    key: (item) => item.id,
    values: () => Promise.resolve(testData),
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
  const projectedMap = new ProjectedMap<string, TestObject>({
    key: (item) => item.id,
    values: async () => {
      throw new Error('fetch error');
    },
  });

  expect(projectedMap).toBeTruthy();

  await expect(projectedMap.getByKey('3')).rejects.toThrow('fetch error');
  await expect(projectedMap.getByKeys(['3', '4'])).rejects.toThrow('fetch error');
});

it('should implement mixed get method', async () => {
  const projectedMap = new ProjectedMap<string, TestObject>({
    key: (item) => item.id,
    values: () => Promise.resolve(testData),
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

describe('refresh', () => {
  it('should return undefined when nothing is cached', async () => {
    const map = new ProjectedMap<string, TestObject>({
      key: (item) => item.id,
      values: () => testData,
    });

    const stale = await map.refresh();

    expect(stale).toBeUndefined();
  });

  it('should return copy of cached map immediately', async () => {
    const map = new ProjectedMap<string, TestObject>({
      key: (item) => item.id,
      values: () => structuredClone(testData),
    });

    // populate cache
    const initial = await map.getAllAsMap();

    expect(initial.size).toBe(5);

    // refresh should return copy of stale map immediately
    const stale = await map.refresh();

    expect(stale).toBeTruthy();
    expect(stale!.size).toBe(5);
    // should be a copy, not the same reference
    expect(stale).not.toBe(initial);
    expect(stale!.get('1')).toEqual(initial.get('1'));
  });

  it('should trigger background fetch and update cache on success', async () => {
    let fetchCount = 0;

    const map = new ProjectedMap<string, TestObject>({
      key: (item) => item.id,
      values: () => {
        fetchCount++;

        return testData.map((item) => ({ ...item, title: `${item.title}-v${fetchCount}` }));
      },
    });

    // populate cache
    const initial = await map.getByKey('1');

    expect(initial?.title).toBe('title1-v1');
    expect(fetchCount).toBe(1);

    // refresh returns stale immediately
    const stale = await map.refresh();

    expect(stale?.get('1')?.title).toBe('title1-v1');

    // wait for background fetch to complete
    await vi.waitFor(async () => {
      const updated = await map.getByKey('1');

      expect(updated?.title).toBe('title1-v2');
    });

    expect(fetchCount).toBe(2);
  });

  it('should keep stale value on refresh error', async () => {
    let shouldFail = false;

    const map = new ProjectedMap<string, TestObject>({
      key: (item) => item.id,
      values: () => {
        if (shouldFail) {
          throw new Error('refresh error');
        }

        return testData;
      },
    });

    // populate cache
    const initial = await map.getByKey('1');

    expect(initial).toEqual(testData[0]);

    // make next fetch fail
    shouldFail = true;

    // refresh returns stale immediately
    const stale = await map.refresh();

    expect(stale?.get('1')).toEqual(testData[0]);

    // wait a bit for background fetch to complete (and fail)
    await new Promise((resolve) => setTimeout(resolve, 10));

    // cache should still have the original value
    const afterError = await map.getByKey('1');

    expect(afterError).toEqual(testData[0]);
  });

  it('should not trigger multiple fetches when called multiple times', async () => {
    let fetchCount = 0;

    const map = new ProjectedMap<string, TestObject>({
      key: (item) => item.id,
      values: async () => {
        fetchCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));

        return testData;
      },
    });

    // populate cache
    await map.getByKey('1');

    expect(fetchCount).toBe(1);

    // call refresh multiple times
    map.refresh();
    map.refresh();
    map.refresh();

    // wait for background fetch to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // should only have fetched twice (initial + one refresh)
    expect(fetchCount).toBe(2);
  });
});
