# LevelFetchResponse

`apps/player/src/LevelFetch.ts` · interface

The part of a `fetch` Response the level catalog reads. With the `LevelFetch` type (`(url) => Promise<LevelFetchResponse>`, same file) it is the fetch [LevelCatalog](LevelCatalog.md) is given; the global `fetch` fits.

## Relationships
- returned by the `LevelFetch` passed to [LevelCatalog](LevelCatalog.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `ok` | property | False for a missing file |
| `json()` | method | The body as JSON (the manifest) |
| `text()` | method | The body as text (a level) |

## Example
```ts
const fake: LevelFetch = (url) =>
  Promise.resolve({ ok: url in files, json: () => Promise.resolve(files[url]), text: () => Promise.resolve(String(files[url])) });
```

## Design notes
The contract half of dependency injection, like render's `TilesetFetchResponse`: only what the catalog reads, so a fake is three lines.
