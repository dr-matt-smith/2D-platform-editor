# TilesetFetchResponse

`packages/render/src/TilesetIO.ts` · interface

The part of a `fetch` Response that [TilesetDirectory](TilesetDirectory.md)
reads. A real `Response` fits it.

## Relationships
- returned by the `TilesetFetch` in [TilesetIO](TilesetIO.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `ok` | property | Did the request succeed? |
| `json()` | method | The body parsed as JSON |

## Example
```ts
const notFound: TilesetFetchResponse = { ok: false, json: () => Promise.resolve(null) };
```

## Design notes
Declaring only the two members used keeps test fakes tiny — the
interface-segregation idea again.
