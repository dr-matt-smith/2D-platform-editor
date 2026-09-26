# LevelLibraryIO

`apps/editor/src/LevelLibraryIO.ts` · interface

Everything the [LevelLibrary](LevelLibrary.md) does I/O with. With it goes
the type alias `LevelFetch = (url: string) => Promise<LevelFetchResponse>`
(the browser's `fetch` fits).

## Relationships
- passed to [LevelLibrary](LevelLibrary.md)
- has a [KeyValueStore](KeyValueStore.md); `fetch` returns a [LevelFetchResponse](LevelFetchResponse.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `fetch` | property | A `LevelFetch` |
| `storage` | property | Where drafts, local levels and the last-open id are kept |

## Example
```ts
const io: LevelLibraryIO = { fetch: (url) => fetch(url), storage: new MemoryStore() };
```

## Design notes
The same shape as render's `TilesetIO`: the side effects a class needs,
gathered into one injectable object.
