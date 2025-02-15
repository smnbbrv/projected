import { it, expect } from 'vitest';

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
