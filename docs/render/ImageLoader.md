# ImageLoader

`packages/render/src/TilesetIO.ts` · interface

Loads an image from a URL, resolving `null` (never rejecting) when it is
missing, so one bad file cannot stop a tileset loading.

## Relationships
- implemented by [BrowserImageLoader](BrowserImageLoader.md) and by test fakes
- the `images` of [TilesetIO](TilesetIO.md); used by [TilesetDirectory](TilesetDirectory.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `load(src)` | method | `Promise<HTMLImageElement \| null>` |

## Example
```ts
const fake: ImageLoader = {
  load: (src) => Promise.resolve({ width: 32, height: 32, src } as unknown as HTMLImageElement),
};
```

## Design notes
The contract half of dependency injection: code depends on this interface,
production supplies [BrowserImageLoader](BrowserImageLoader.md), tests a fake.
