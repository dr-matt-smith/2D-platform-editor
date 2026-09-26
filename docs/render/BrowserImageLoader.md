# BrowserImageLoader

`packages/render/src/BrowserImageLoader.ts` · class

The real [ImageLoader](ImageLoader.md): loads an image through an `<img>`
element, resolving `null` if it fails to load.

## Relationships
- implements [ImageLoader](ImageLoader.md)
- the default used by [TilesetDirectory](TilesetDirectory.md) when [TilesetIO](TilesetIO.md) gives no `images`

## Members
| Member | Kind | Description |
|---|---|---|
| `load(src)` | method | `Promise<HTMLImageElement \| null>`; never rejects |

## Example
```ts
const image = await new BrowserImageLoader().load('/data/tilesets/PWYP/tiles/Block.png');
if (!image) { /* draw a fallback shape instead */ }
```

## Design notes
The production half of a dependency-injection pair: code depends on the
[ImageLoader](ImageLoader.md) interface, this class is the browser version,
and tests supply a fake (Deno has no `Image`).
