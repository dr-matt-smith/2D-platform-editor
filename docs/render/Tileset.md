# Tileset

`packages/render/src/Tileset.ts` · class

A loaded tileset: the images in one folder under `/data/tilesets/` plus its
`tile_lookup.json`, able to answer "what do I draw for this cell?". Every
answer is a [DrawSpec](DrawSpec.md) or `null`, and `null` is never an error —
it tells the renderer to draw a fallback shape, so a tileset with missing
images still shows a level.

## Relationships
- implements [RenderTileset](RenderTileset.md), so a [LevelRenderer](LevelRenderer.md) can draw with it
- built by the static factory `load`, which reads files through a [TilesetDirectory](TilesetDirectory.md) (using the injected [TilesetIO](TilesetIO.md))
- holds a [Sprite](Sprite.md) per glyph and per terrain mask — each a [DrawSpec](DrawSpec.md) or a [SpriteAnimation](SpriteAnimation.md)
- reads a [TileLookup](TileLookup.md); uses level-format's `Legend` to find each glyph's role, and [ImageRole](ImageRole.md) to sort `images`
- takes an [EntityState](EntityState.md) in `entityFor`
- used by the editor and the player app, which load one per level (`Tileset.load(level.meta.tileset)`)

## Members
| Member | Kind | Description |
|---|---|---|
| `DEFAULT_ID` | static readonly | `'Dirt_Platformer_Tiles'` (level-format's `Level.DEFAULT_TILESET`) |
| `load(id?, io?)` | static async method | Load the tileset in folder `id`; always resolves. `io` replaces fetch / image loading |
| `id` | readonly property | The folder name |
| `image` | readonly property | The atlas image (`platformertiles.png`), or `null` |
| `lookup` | readonly property | The parsed [TileLookup](TileLookup.md), or `null` if it could not be read |
| `atlasReady` | get accessor | `true` when the atlas loaded (the sky and decor passes need it) |
| `ready` | get accessor | Older name for `atlasReady` |
| `drawTile(ctx, index, dx, dy, size)` | method | Draw 32-px atlas tile `index` (8 per row) into a cell |
| `terrainFor(mask, now?)` | method | Terrain sprite for a 4-neighbour mask: the mask's image → `terrain.default` → the `#` glyph's image → `null` |
| `entityFor(char, now?, state?)` | method | Entity sprite; `null` for decoration / foreground glyphs. With `state.exitLocked`, `E` uses its `imageLocked` sprite if it has one |
| `decorationFor(char, now?)` | method | Sprite of a decoration glyph (drawn under entities), else `null` |
| `foregroundFor(char, now?)` | method | Sprite of a foreground glyph (drawn over entities), else `null` |
| `backgroundImage(id)` | method | The `images.<id>` entry with role `background`, or `null` |
| `decorationImage(id)` | method | The `images.<id>` entry with role `decoration`, or `null` |

`now` is a time in ms (`performance.now()`); leaving it out gives frame 0
of any animation, which keeps the editor preview still.

## Example
```ts
import { LevelRenderer, Tileset } from '@2d-platform/render';

const tileset = await Tileset.load('Pixel_Adventure_1');
tileset.entityFor('P', performance.now());   // DrawSpec for this frame, or null
tileset.terrainFor(5);                       // mask 5 = solid above and below

new LevelRenderer(tileset, 24).draw(ctx, level);

// In a test: fake I/O, no network or DOM.
const t = await Tileset.load('x', {
  fetch: (url) => Promise.resolve({ ok: true, json: () => Promise.resolve(lookup) }),
  images: { load: (src) => Promise.resolve(stubImage(src)) },
});
```

## Design notes
- **Static factory, private constructor.** Loading fetches files and can
  fail, so it lives in `Tileset.load`; the constructor only stores what was
  loaded. A `Tileset` therefore always exists fully formed.
- **Dependency injection.** The fetch function and [ImageLoader](ImageLoader.md)
  arrive through [TilesetIO](TilesetIO.md). Production passes nothing and gets
  the browser's; tests pass fakes.
- **Polymorphism instead of type checks.** Each glyph is stored as a
  [Sprite](Sprite.md). Whether it is a still [DrawSpec](DrawSpec.md) or a
  [SpriteAnimation](SpriteAnimation.md), the tileset just calls `frameAt(now)`.
- **Encapsulation.** The sprite maps and role sets are `private readonly`;
  callers only ask questions. The class is immutable once loaded.
- **Roles, not characters.** Decorations and foreground glyphs are found by
  their `Role` in the legend, so a tileset can use any characters for them.
  The exit's locked sprite is still keyed on `E`, as it always has been.
- **Implements an interface.** The renderer depends on
  [RenderTileset](RenderTileset.md), not on this class, so tests can hand it a
  small fake.
