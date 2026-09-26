# TilesetDirectory

`packages/render/src/TilesetDirectory.ts` · class

One tileset's folder under `/data/tilesets/`, and the files in it. It turns
paths from `tile_lookup.json` into URLs and loads them through the injected
I/O, so [Tileset](Tileset.md)`.load` deals only with what the files mean.

## Relationships
- created by [Tileset](Tileset.md)`.load`, one per load
- uses a `TilesetFetch` and an [ImageLoader](ImageLoader.md) from [TilesetIO](TilesetIO.md), defaulting to `fetch` and [BrowserImageLoader](BrowserImageLoader.md)
- builds [Sprite](Sprite.md)s with a [SpriteStrip](SpriteStrip.md)
- returns a [TileLookup](TileLookup.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new TilesetDirectory(id, io?)` | constructor | The folder for tileset `id` |
| `id` | readonly property | The folder name |
| `url` | readonly property | `<base>data/tilesets/<id>/`, where base is Vite's `BASE_URL` (`/` outside Vite) |
| `image(path)` | method | Load `url + path` as an image; `null` if it fails |
| `lookup()` | async method | Read `tile_lookup.json`; `null` when missing, unreadable or offline |
| `sprite(path, frames?, frame?, fps?)` | async method | Load an image and turn it into a [Sprite](Sprite.md) (see [SpriteStrip](SpriteStrip.md)`.toSprite`); `null` if the image fails |

## Example
```ts
const dir = new TilesetDirectory('PWYP');
dir.url;                                  // '/data/tilesets/PWYP/'
const lookup = await dir.lookup();
const player = await dir.sprite('Idle.png', 11); // an 11-frame animation
```

## Design notes
- **Single responsibility.** Where files live and how they are fetched is
  kept apart from what a tileset does with them.
- **Failure is a value.** Every method resolves to `null` rather than
  throwing, which is what lets a tileset with missing files still load.
- Exported for tests and teaching; apps only need [Tileset](Tileset.md).
