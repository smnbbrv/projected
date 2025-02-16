export class Deferred<T> {
  private _resolve!: (value: T) => void;
  private _reject!: (reason: any) => void;

  readonly promise = new Promise<T>((resolve, reject) => {
    this._resolve = resolve;
    this._reject = reject;
  });

  resolve(value: T) {
    this._resolve(value);
  }

  reject(reason: any) {
    this._reject(reason);
  }
}
