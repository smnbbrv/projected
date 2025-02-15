import { it, expect } from 'vitest';

import { createProjectedValue, ProjectedValue } from './projected-value.js';

const testValue = { id: '1', title: 'title1' };

it('should create value with createProjectedValue', () => {
  const value = createProjectedValue({
    value: () => testValue,
  });

  expect(value).toBeTruthy();
  expect(value).toBeInstanceOf(ProjectedValue);
});

it('should implement get', async () => {
  const value = new ProjectedValue({
    value: () => testValue,
  });

  expect(value).toBeTruthy();

  const res = await value.get();

  expect(res).toEqual({ id: '1', title: 'title1' });
});

it('should throw if return value is undefined', async () => {
  const value = new ProjectedValue({
    value: () => undefined,
  });

  await expect(value.get()).rejects.toThrow('Return value "undefined" is not allowed in ProjectedValue');
});

it('should implement clear', async () => {
  const value = new ProjectedValue({
    value: () => structuredClone(testValue),
  });

  const res1 = await value.get();

  expect(res1).toEqual({ id: '1', title: 'title1' });

  const res2 = await value.get();

  // same object
  expect(res2).toBe(res1);

  value.clear();

  const res3 = await value.get();

  // new object same value
  expect(res1).toEqual({ id: '1', title: 'title1' });
  expect(res3).not.toBe(res1);
});

it('should propagate errors', async () => {
  const projectedValue = new ProjectedValue({
    value: async () => {
      throw new Error('fetch error');
    },
  });

  expect(projectedValue).toBeTruthy();

  await expect(projectedValue.get()).rejects.toThrow('fetch error');
});
