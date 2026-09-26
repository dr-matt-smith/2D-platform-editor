import type { KeyValueStore } from './KeyValueStore.ts';

// A `KeyValueStore` kept in memory for the life of the page. Used when the
// browser refuses localStorage (private mode), and as the fake in tests.
export class MemoryStore implements KeyValueStore {
  private readonly items: Map<string, string>;

  constructor(seed: Record<string, string> = {}) {
    this.items = new Map(Object.entries(seed));
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  has(key: string): boolean {
    return this.items.has(key);
  }
}
