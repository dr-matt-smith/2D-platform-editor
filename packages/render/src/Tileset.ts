import { Legend, Level, Role } from '@2d-platform/level-format';
import { ImageRole } from './ImageRole.ts';
import { TilesetDirectory } from './TilesetDirectory.ts';
import type { DrawSpec } from './DrawSpec.ts';
import type { EntityState } from './EntityState.ts';
import type { RenderTileset } from './RenderTileset.ts';
import type { Sprite } from './Sprite.ts';
import type { TileLookup, TerrainMasks } from './TileLookup.ts';
import type { TilesetIO } from './TilesetIO.ts';

// Everything `Tileset.load` gathers, handed to the private constructor.
interface TilesetContents {
  id: string;
  atlas: HTMLImageElement | null;
  lookup: TileLookup | null;
  terrainMasks: Map<string, Sprite>;
  terrainDefault: Sprite | null;
  glyphs: Map<string, Sprite>;
  lockedGlyphs: Map<string, Sprite>;
  decorationGlyphs: Set<string>;
  foregroundGlyphs: Set<string>;
  backgroundImages: Map<string, HTMLImageElement>;
  decorationImages: Map<string, HTMLImageElement>;
}

// A loaded tileset: the images from one folder under /data/tilesets/ and
// its tile_lookup.json, able to answer "what do I draw for this cell?".
//
// Every answer is a `DrawSpec` (an image and the part of it to draw) or
// null. Null is never an error: it tells the renderer to draw a coloured
// shape instead, so a tileset with missing images still shows a level.
//
// The Dirt tileset also has an atlas image (`platformertiles.png`) of
// 32-px tiles that the renderer's sky and decor passes draw from.
export class Tileset implements RenderTileset {
  // The tileset a level uses when it names none.
  static readonly DEFAULT_ID = Level.DEFAULT_TILESET;
  // Atlas geometry: square tiles, numbered left to right in rows of 8.
  private static readonly ATLAS_TILE = 32;
  private static readonly ATLAS_COLUMNS = 8;

  readonly id: string;
  // The atlas image, or null when this tileset has none.
  readonly image: HTMLImageElement | null;
  // The parsed tile_lookup.json, or null when it could not be read.
  readonly lookup: TileLookup | null;
  private readonly terrainMasks: Map<string, Sprite>;
  private readonly terrainDefault: Sprite | null;
  private readonly glyphs: Map<string, Sprite>;
  private readonly lockedGlyphs: Map<string, Sprite>;
  private readonly decorationGlyphs: Set<string>;
  private readonly foregroundGlyphs: Set<string>;
  private readonly backgroundImages: Map<string, HTMLImageElement>;
  private readonly decorationImages: Map<string, HTMLImageElement>;

  private constructor(contents: TilesetContents) {
    this.id = contents.id;
    this.image = contents.atlas;
    this.lookup = contents.lookup;
    this.terrainMasks = contents.terrainMasks;
    this.terrainDefault = contents.terrainDefault;
    this.glyphs = contents.glyphs;
    this.lockedGlyphs = contents.lockedGlyphs;
    this.decorationGlyphs = contents.decorationGlyphs;
    this.foregroundGlyphs = contents.foregroundGlyphs;
    this.backgroundImages = contents.backgroundImages;
    this.decorationImages = contents.decorationImages;
  }

  // Load the tileset in folder `id`. Always resolves: anything missing
  // just makes the matching questions answer null. Pass `io` to replace
  // the browser's fetch and image loading (tests do).
  static async load(id: string = Tileset.DEFAULT_ID, io: TilesetIO = {}): Promise<Tileset> {
    const dir = new TilesetDirectory(id, io);
    const atlas = await dir.image('platformertiles.png');
    const lookup = await dir.lookup();

    // Terrain: one sprite per autotile mask, plus a single default. The
    // new `terrain.masks` wins over the legacy `filled` table.
    const terrainMasks = await Tileset.loadTerrainMasks(
      dir,
      lookup?.terrain?.masks ?? lookup?.filled ?? null,
    );
    const defaultPath = lookup?.terrain?.default?.image;
    const terrainDefault = defaultPath ? await dir.sprite(defaultPath) : null;

    // Glyph sprites by character. The legend gives each glyph's role, so
    // decorations and foreground glyphs can be kept apart from entities:
    // the renderer draws them in their own passes.
    const legend = Legend.fromLookup(lookup);
    const glyphs = new Map<string, Sprite>();
    const lockedGlyphs = new Map<string, Sprite>();
    const decorationGlyphs = new Set<string>();
    const foregroundGlyphs = new Set<string>();
    for (const g of Object.values(lookup?.glyphs ?? {})) {
      if (!g?.char || !g?.image) continue;
      const sprite = await dir.sprite(g.image, g.frames, g.frame, g.fps);
      if (sprite) glyphs.set(g.char, sprite);
      // The locked variant is cut up the same way as the main image.
      if (g.imageLocked) {
        const locked = await dir.sprite(g.imageLocked, g.frames, g.frame, g.fps);
        if (locked) lockedGlyphs.set(g.char, locked);
      }
      const role = legend.roleOf(g.char);
      if (role === Role.Decoration) decorationGlyphs.add(g.char);
      else if (role === Role.Foreground) foregroundGlyphs.add(g.char);
    }

    // Whole images by id, sorted by role.
    const backgroundImages = new Map<string, HTMLImageElement>();
    const decorationImages = new Map<string, HTMLImageElement>();
    await Promise.all(
      Object.entries(lookup?.images ?? {}).map(async ([imageId, def]) => {
        if (!def?.image) return;
        const image = await dir.image(def.image);
        if (!image) return;
        if (def.role === ImageRole.Background) backgroundImages.set(imageId, image);
        else if (def.role === ImageRole.Decoration) decorationImages.set(imageId, image);
      }),
    );

    return new Tileset({
      id,
      atlas,
      lookup,
      terrainMasks,
      terrainDefault,
      glyphs,
      lockedGlyphs,
      decorationGlyphs,
      foregroundGlyphs,
      backgroundImages,
      decorationImages,
    });
  }

  private static async loadTerrainMasks(
    dir: TilesetDirectory,
    masks: TerrainMasks | null,
  ): Promise<Map<string, Sprite>> {
    const sprites = new Map<string, Sprite>();
    await Promise.all(
      Object.entries(masks ?? {}).map(async ([mask, def]) => {
        if (!def?.image) return;
        const sprite = await dir.sprite(def.image);
        if (sprite) sprites.set(mask, sprite);
      }),
    );
    return sprites;
  }

  // True when the atlas loaded; the renderer's sky and decor passes
  // need it.
  get atlasReady(): boolean {
    return this.image !== null;
  }

  // Older name for `atlasReady`.
  get ready(): boolean {
    return this.atlasReady;
  }

  // Draw atlas tile `index` into the `size`-px cell at (dx, dy).
  drawTile(ctx: CanvasRenderingContext2D, index: number, dx: number, dy: number, size: number): void {
    if (!this.image) return;
    const tile = Tileset.ATLAS_TILE;
    const sx = (index % Tileset.ATLAS_COLUMNS) * tile;
    const sy = Math.floor(index / Tileset.ATLAS_COLUMNS) * tile;
    ctx.drawImage(this.image, sx, sy, tile, tile, dx, dy, size, size);
  }

  // The terrain sprite for a 4-neighbour mask (0..15), trying in turn:
  // the mask's own image, the terrain default, then the `#` glyph's image
  // (its legend thumbnail). `now` only matters if that glyph is animated.
  terrainFor(mask: number | string, now?: number): DrawSpec | null {
    const sprite = this.terrainMasks.get(String(mask)) ?? this.terrainDefault ??
      this.glyphs.get('#') ?? null;
    return sprite?.frameAt(now) ?? null;
  }

  // The sprite for an entity glyph (player, exit, pickup, …) at `now`.
  // Null for decoration and foreground glyphs, which have their own
  // methods, so the renderer's entity pass never draws them twice. With
  // `state.exitLocked`, the exit `E` shows its locked sprite if it has one.
  entityFor(char: string, now?: number, state?: EntityState | null): DrawSpec | null {
    if (this.decorationGlyphs.has(char) || this.foregroundGlyphs.has(char)) return null;
    const locked = state?.exitLocked && char === 'E' ? this.lockedGlyphs.get('E') : undefined;
    return (locked ?? this.glyphs.get(char))?.frameAt(now) ?? null;
  }

  // The sprite for a decoration glyph (drawn under entities), else null.
  decorationFor(char: string, now?: number): DrawSpec | null {
    if (!this.decorationGlyphs.has(char)) return null;
    return this.glyphs.get(char)?.frameAt(now) ?? null;
  }

  // The sprite for a foreground glyph (drawn over entities), else null.
  foregroundFor(char: string, now?: number): DrawSpec | null {
    if (!this.foregroundGlyphs.has(char)) return null;
    return this.glyphs.get(char)?.frameAt(now) ?? null;
  }

  // The `images.<id>` entry with role background, or null.
  backgroundImage(id: string): HTMLImageElement | null {
    return this.backgroundImages.get(id) ?? null;
  }

  // The `images.<id>` entry with role decoration, or null.
  decorationImage(id: string): HTMLImageElement | null {
    return this.decorationImages.get(id) ?? null;
  }
}
