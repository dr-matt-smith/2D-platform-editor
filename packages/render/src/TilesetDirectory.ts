import { BrowserImageLoader } from './BrowserImageLoader.ts';
import { SpriteStrip } from './SpriteStrip.ts';
import type { Sprite } from './Sprite.ts';
import type { TileLookup } from './TileLookup.ts';
import type { ImageLoader, TilesetFetch, TilesetIO } from './TilesetIO.ts';

// Vite's deploy base: '/' in development, '/2D-platform-editor/' on GitHub
// Pages. Undefined outside Vite (Deno tests), hence the fallback.
const BASE = import.meta.env?.BASE_URL ?? '/';

// One tileset's folder under /data/tilesets/, and the files in it. It
// resolves paths from tile_lookup.json against the folder and loads them
// through the injected I/O, so `Tileset.load` deals only in meaning.
export class TilesetDirectory {
  readonly url: string;
  private readonly fetch: TilesetFetch;
  private readonly images: ImageLoader;

  constructor(readonly id: string, io: TilesetIO = {}) {
    this.url = `${BASE}data/tilesets/${id}/`;
    this.fetch = io.fetch ?? globalThis.fetch.bind(globalThis);
    this.images = io.images ?? new BrowserImageLoader();
  }

  // Load a file in the folder as an image; null if it fails.
  image(path: string): Promise<HTMLImageElement | null> {
    return this.images.load(this.url + path);
  }

  // Read tile_lookup.json. A missing or unreadable file gives null; the
  // tileset then answers null to every question and the renderer draws
  // coloured shapes instead.
  async lookup(): Promise<TileLookup | null> {
    try {
      const res = await this.fetch(this.url + 'tile_lookup.json');
      if (res.ok) return (await res.json()) as TileLookup;
    } catch {
      // Offline or missing: fall through to null.
    }
    return null;
  }

  // Load an image and describe how to show it (see `SpriteStrip.toSprite`).
  async sprite(
    path: string,
    frames: number | null = 1,
    frame: number | null = null,
    fps: number | null = null,
  ): Promise<Sprite | null> {
    const image = await this.image(path);
    return image ? new SpriteStrip(image, frames).toSprite(frame, fps) : null;
  }
}
