# TilesetIO

`packages/render/src/TilesetIO.ts` · interface

The collaborators passed to [Tileset](Tileset.md)`.load`: how to fetch the
lookup file and how to load images. Either may be left out to use the
browser's own.

## Relationships
- taken by [Tileset](Tileset.md)`.load` and [TilesetDirectory](TilesetDirectory.md)
- holds a `TilesetFetch` and an [ImageLoader](ImageLoader.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `fetch` | optional property | `TilesetFetch` — `(url) => Promise<`[TilesetFetchResponse](TilesetFetchResponse.md)`>`; defaults to the global `fetch` |
| `images` | optional property | [ImageLoader](ImageLoader.md); defaults to [BrowserImageLoader](BrowserImageLoader.md) |

`TilesetFetch` is a function type alias, so the real `fetch` fits it as is.

## Example
```ts
await Tileset.load('x', {
  fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }),
  images: { load: () => Promise.resolve(null) },
});   // loads, and every question answers null
```

## Design notes
**Dependency injection.** The tileset's only I/O comes in through this
object, which is what lets the unit tests run in Deno with no DOM and no
network.
