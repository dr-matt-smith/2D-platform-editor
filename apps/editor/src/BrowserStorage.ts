import type { KeyValueStore } from './KeyValueStore.ts';
import { MemoryStore } from './MemoryStore.ts';

// The browser's localStorage as a `KeyValueStore`. Each call reaches
// `localStorage` afresh, so a browser that refuses storage throws from the
// call rather than from construction; callers that must never throw
// (`Preferences`) catch it, and `withFallback` avoids it altogether.
export class BrowserStorage implements KeyValueStore {
  private static readonly PROBE_KEY = '__ld_probe__';

  getItem(key: string): string | null {
    return localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  // localStorage if it works, otherwise an in-memory store: the editor
  // still runs in private mode, it just forgets drafts on reload.
  static withFallback(): KeyValueStore {
    try {
      const store = new BrowserStorage();
      store.setItem(BrowserStorage.PROBE_KEY, '1');
      store.removeItem(BrowserStorage.PROBE_KEY);
      return store;
    } catch {
      return new MemoryStore();
    }
  }
}
