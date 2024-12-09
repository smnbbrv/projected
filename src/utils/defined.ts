export function defined<T>(val: T | undefined | void): val is T {
  return val !== undefined;
}
