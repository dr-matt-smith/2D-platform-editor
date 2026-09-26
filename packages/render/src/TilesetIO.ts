// The I/O a tileset needs, as interfaces so tests can pass fakes (Deno has
// no `Image`, and tests should not touch the network).

// The part of a `fetch` Response the tileset reads.
export interface TilesetFetchResponse {
  ok: boolean;
  json(): Promise<unknown>;
}

// Fetches a URL. The global `fetch` fits this type.
export type TilesetFetch = (url: string) => Promise<TilesetFetchResponse>;

// Loads an image. Resolves null (never rejects) when the image is missing,
// so one bad file cannot stop a tileset loading.
export interface ImageLoader {
  load(src: string): Promise<HTMLImageElement | null>;
}

// The collaborators passed to `Tileset.load`. Either may be left out to
// use the browser's own (`fetch`, `BrowserImageLoader`).
export interface TilesetIO {
  fetch?: TilesetFetch;
  images?: ImageLoader;
}
