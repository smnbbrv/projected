import { describe, expect, it } from 'vitest';

import { maybeCatch, maybeThen } from './maybe-then.js';

describe('maybeThen', () => {
  it('should transform sync value directly', () => {
    const result = maybeThen(42, (v) => v * 2);

    expect(result).toBe(84);
  });

  it('should chain on Promise value', async () => {
    const result = maybeThen(Promise.resolve(42), (v) => v * 2);

    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(84);
  });

  it('should handle sync transformation returning Promise', async () => {
    const result = maybeThen(42, (v) => Promise.resolve(v * 2));

    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(84);
  });

  it('should chain multiple transformations', () => {
    const result = maybeThen(
      maybeThen(
        maybeThen(10, (v) => v * 2),
        (v) => v + 5,
      ),
      (v) => v.toString(),
    );

    expect(result).toBe('25');
  });

  it('should chain multiple async transformations', async () => {
    const result = maybeThen(
      maybeThen(
        maybeThen(Promise.resolve(10), (v) => v * 2),
        (v) => v + 5,
      ),
      (v) => v.toString(),
    );

    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe('25');
  });

  it('should handle undefined values', () => {
    const result = maybeThen(undefined as number | undefined, (v) => v);

    expect(result).toBe(undefined);
  });

  it('should handle null values', () => {
    const result = maybeThen(null as number | null, (v) => v);

    expect(result).toBe(null);
  });
});

describe('maybeCatch', () => {
  it('should return sync value as-is', () => {
    const result = maybeCatch(42, () => 0);

    expect(result).toBe(42);
  });

  it('should catch Promise rejection', async () => {
    const result = maybeCatch(Promise.reject(new Error('oops')), () => 99);

    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(99);
  });

  it('should pass through resolved Promise', async () => {
    const result = maybeCatch(Promise.resolve(42), () => 99);

    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(42);
  });

  it('should work with maybeThen', async () => {
    const failing = Promise.reject(new Error('failed'));

    const result = maybeCatch(
      maybeThen(failing, (v) => v * 2),
      () => -1,
    );

    expect(await result).toBe(-1);
  });
});
