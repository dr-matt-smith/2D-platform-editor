# LevelFetchResponse

`apps/editor/src/LevelLibraryIO.ts` · interface

The part of a fetch `Response` the [LevelLibrary](LevelLibrary.md) reads.

## Relationships
- returned by `LevelFetch` (see [LevelLibraryIO](LevelLibraryIO.md)); the browser's `Response` satisfies it

## Members
| Member | Kind | Description |
|---|---|---|
| `ok` | property | Whether the request succeeded |
| `json()` | method | The body as JSON (manifests) |
| `text()` | method | The body as text (level files) |

## Example
```ts
const fake = async (url: string): Promise<LevelFetchResponse> =>
  ({ ok: true, json: async () => [], text: async () => '#####' });
```

## Design notes
Depending on three members instead of `Response` keeps test fakes tiny.
