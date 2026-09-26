// The part of `fetch` the level catalog uses, as interfaces so tests can
// serve files from a table instead of the network.

// The part of a fetch Response the catalog reads.
export interface LevelFetchResponse {
  ok: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

// Fetches a URL. The global `fetch` fits this type.
export type LevelFetch = (url: string) => Promise<LevelFetchResponse>;
