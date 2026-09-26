// A string key-value store: the part of the browser's `Storage`
// (localStorage) the editor uses. Code that persists anything depends on
// this interface, so tests pass a `MemoryStore` instead of the real thing.
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
