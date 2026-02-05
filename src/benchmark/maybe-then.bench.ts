import { bench, describe } from 'vitest';

import type { MaybePromise } from '../types/maybe-promise.js';

/**
 * Benchmark comparing different approaches for working with MaybePromise<T>:
 * 1. maybeThen() utility function
 * 2. MaybePromise wrapper class with .then(), .catch() methods
 * 3. Raw instanceof check (baseline)
 */

// utility function approach
function maybeThen<T, R>(value: MaybePromise<T>, fn: (v: T) => MaybePromise<R>): MaybePromise<R> {
  if (value instanceof Promise) {
    return value.then(fn);
  }

  return fn(value);
}

function maybeCatch<T>(value: MaybePromise<T>, fn: (e: unknown) => MaybePromise<T>): MaybePromise<T> {
  if (value instanceof Promise) {
    return value.catch(fn);
  }

  return value;
}

// wrapper class approach
class MaybePromiseWrapper<T> {
  constructor(private readonly value: MaybePromise<T>) {}

  then<R>(fn: (v: T) => MaybePromise<R>): MaybePromiseWrapper<R> {
    if (this.value instanceof Promise) {
      return new MaybePromiseWrapper(this.value.then(fn));
    }

    return new MaybePromiseWrapper(fn(this.value));
  }

  catch(fn: (e: unknown) => MaybePromise<T>): MaybePromiseWrapper<T> {
    if (this.value instanceof Promise) {
      return new MaybePromiseWrapper(this.value.catch(fn));
    }

    return this;
  }

  unwrap(): MaybePromise<T> {
    return this.value;
  }
}

// lightweight wrapper - just stores value, methods are external
interface LightWrapper<T> {
  value: MaybePromise<T>;
}

function wrapperThen<T, R>(wrapper: LightWrapper<T>, fn: (v: T) => MaybePromise<R>): LightWrapper<R> {
  if (wrapper.value instanceof Promise) {
    return { value: wrapper.value.then(fn) };
  }

  return { value: fn(wrapper.value) };
}

// test data
const cache = new Map<number, { id: number; name: string }>();

for (let i = 0; i < 100; i++) {
  cache.set(i, { id: i, name: `item-${i}` });
}

const getValue = (key: number): MaybePromise<{ id: number; name: string }> => {
  return cache.get(key)!;
};

describe('Single operation (1000x)', () => {
  bench('raw instanceof + direct access', () => {
    for (let i = 0; i < 1000; i++) {
      const result = getValue(i % 100);

      if (!(result instanceof Promise)) {
        void result.id;
      }
    }
  });

  bench('maybeThen() utility', () => {
    for (let i = 0; i < 1000; i++) {
      maybeThen(getValue(i % 100), (v) => v.id);
    }
  });

  bench('MaybePromiseWrapper class', () => {
    for (let i = 0; i < 1000; i++) {
      new MaybePromiseWrapper(getValue(i % 100)).then((v) => v.id).unwrap();
    }
  });

  bench('LightWrapper + external function', () => {
    for (let i = 0; i < 1000; i++) {
      void wrapperThen({ value: getValue(i % 100) }, (v) => v.id).value;
    }
  });
});

describe('Chained operations (1000x, 3 transforms)', () => {
  bench('raw instanceof - nested', () => {
    for (let i = 0; i < 1000; i++) {
      const r1 = getValue(i % 100);

      if (!(r1 instanceof Promise)) {
        const r2 = r1.id * 2;
        const r3 = r2 + 1;

        void (r3 > 0);
      }
    }
  });

  bench('maybeThen() chained', () => {
    for (let i = 0; i < 1000; i++) {
      maybeThen(
        maybeThen(
          maybeThen(getValue(i % 100), (v) => v.id * 2),
          (v) => v + 1,
        ),
        (v) => v > 0,
      );
    }
  });

  bench('MaybePromiseWrapper chained', () => {
    for (let i = 0; i < 1000; i++) {
      new MaybePromiseWrapper(getValue(i % 100))
        .then((v) => v.id * 2)
        .then((v) => v + 1)
        .then((v) => v > 0)
        .unwrap();
    }
  });

  bench('LightWrapper chained', () => {
    for (let i = 0; i < 1000; i++) {
      void wrapperThen(
        wrapperThen(
          wrapperThen({ value: getValue(i % 100) }, (v) => v.id * 2),
          (v) => v + 1,
        ),
        (v) => v > 0,
      ).value;
    }
  });
});

describe('With error handling (1000x)', () => {
  bench('maybeThen + maybeCatch', () => {
    for (let i = 0; i < 1000; i++) {
      maybeCatch(
        maybeThen(getValue(i % 100), (v) => v.id),
        () => -1,
      );
    }
  });

  bench('MaybePromiseWrapper .then().catch()', () => {
    for (let i = 0; i < 1000; i++) {
      new MaybePromiseWrapper(getValue(i % 100))
        .then((v) => v.id)
        .catch(() => -1)
        .unwrap();
    }
  });
});

describe('instanceof vs thenable check (1000x)', () => {
  // thenable check - duck typing for Promise-like objects
  const isThenable = <T>(value: unknown): value is PromiseLike<T> =>
    value != null && typeof (value as PromiseLike<T>).then === 'function';

  // alternative thenable check with explicit object check
  const isThenableSafe = <T>(value: unknown): value is PromiseLike<T> =>
    value != null && typeof value === 'object' && typeof (value as PromiseLike<T>).then === 'function';

  bench('instanceof Promise', () => {
    for (let i = 0; i < 1000; i++) {
      const result = getValue(i % 100);

      if (!(result instanceof Promise)) {
        void result.id;
      }
    }
  });

  bench('thenable check (typeof .then)', () => {
    for (let i = 0; i < 1000; i++) {
      const result = getValue(i % 100);

      if (!isThenable(result)) {
        void result.id;
      }
    }
  });

  bench('thenable check (typeof object + .then)', () => {
    for (let i = 0; i < 1000; i++) {
      const result = getValue(i % 100);

      if (!isThenableSafe(result)) {
        void result.id;
      }
    }
  });

  // inline checks (no function call overhead)
  bench('instanceof Promise (inline)', () => {
    for (let i = 0; i < 1000; i++) {
      const result = getValue(i % 100);

      if (!(result instanceof Promise)) {
        void result.id;
      }
    }
  });

  bench('thenable check (inline)', () => {
    for (let i = 0; i < 1000; i++) {
      const result: MaybePromise<{ id: number; name: string }> = getValue(i % 100);

      if (!(result != null && typeof (result as PromiseLike<unknown>).then === 'function')) {
        void (result as { id: number; name: string }).id;
      }
    }
  });
});

describe('thenable false positives', () => {
  // objects that would incorrectly be detected as thenables
  const objectWithThenProp = { then: 'not a function', id: 1 };
  const objectWithThenMethod = { then: () => 'gotcha', id: 2 };

  const isThenable = <T>(value: unknown): value is PromiseLike<T> =>
    value != null && typeof (value as PromiseLike<T>).then === 'function';

  bench('instanceof - correctly handles object with .then prop', () => {
    for (let i = 0; i < 1000; i++) {
      const result = objectWithThenProp;

      if (!(result instanceof Promise)) {
        void result.id; // correctly accessed
      }
    }
  });

  bench('instanceof - correctly handles object with .then method', () => {
    for (let i = 0; i < 1000; i++) {
      const result = objectWithThenMethod;

      if (!(result instanceof Promise)) {
        void result.id; // correctly accessed
      }
    }
  });

  bench('thenable - FALSE POSITIVE with .then method!', () => {
    for (let i = 0; i < 1000; i++) {
      const result = objectWithThenMethod;

      if (!isThenable(result)) {
        void result.id; // never reached! bug!
      }
    }
  });
});

describe('maybeThen variants', () => {
  // instanceof version
  function maybeThenInstanceof<T, R>(value: MaybePromise<T>, fn: (v: T) => MaybePromise<R>): MaybePromise<R> {
    if (value instanceof Promise) {
      return value.then(fn);
    }

    return fn(value);
  }

  // thenable version
  function maybeThenThenable<T, R>(value: MaybePromise<T>, fn: (v: T) => MaybePromise<R>): MaybePromise<R> {
    if (value != null && typeof (value as PromiseLike<T>).then === 'function') {
      return (value as Promise<T>).then(fn);
    }

    return fn(value as T);
  }

  bench('maybeThen (instanceof)', () => {
    for (let i = 0; i < 1000; i++) {
      maybeThenInstanceof(getValue(i % 100), (v) => v.id);
    }
  });

  bench('maybeThen (thenable)', () => {
    for (let i = 0; i < 1000; i++) {
      maybeThenThenable(getValue(i % 100), (v) => v.id);
    }
  });
});

describe('Mixed sync/async scenario', () => {
  const mixedGetValue = (key: number): MaybePromise<{ id: number; name: string }> => {
    // 90% cache hits (sync), 10% async
    if (key % 10 === 0) {
      return Promise.resolve(cache.get(key % 100)!);
    }

    return cache.get(key % 100)!;
  };

  bench('maybeThen() - mixed', async () => {
    for (let i = 0; i < 1000; i++) {
      const result = maybeThen(mixedGetValue(i), (v) => v.id);

      if (result instanceof Promise) {
        await result;
      }
    }
  });

  bench('MaybePromiseWrapper - mixed', async () => {
    for (let i = 0; i < 1000; i++) {
      const result = new MaybePromiseWrapper(mixedGetValue(i)).then((v) => v.id).unwrap();

      if (result instanceof Promise) {
        await result;
      }
    }
  });
});
