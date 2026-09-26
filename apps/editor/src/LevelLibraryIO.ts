import type { KeyValueStore } from './KeyValueStore.ts';

// The part of a fetch `Response` the level library reads.
export interface LevelFetchResponse {
  ok: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

// Fetch a URL. The browser's `fetch` fits; tests pass a fake.
export type LevelFetch = (url: string) => Promise<LevelFetchResponse>;

// Everything the level library does I/O with, injected so the library runs
// headless in tests.
export interface LevelLibraryIO {
  fetch: LevelFetch;
  storage: KeyValueStore;
}
