import type { ImageLoader } from './TilesetIO.ts';

// The real `ImageLoader`: loads through an `<img>` element. A failed load
// resolves null so the renderer can fall back to a coloured shape.
export class BrowserImageLoader implements ImageLoader {
  load(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }
}
