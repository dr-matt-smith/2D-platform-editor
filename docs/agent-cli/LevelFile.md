# LevelFile

`apps/agent-cli/src/LevelFile.ts` · interface

A level's text plus where it came from.

## Relationships
- returned by [ContentStore](ContentStore.md)`.resolve()` and `loadBundled()`
- extended by [PreparedLevel](PreparedLevel.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `id` | property | The manifest id, or `null` for a level given as a path |
| `path` | property | Where it was read from |
| `text` | property | The level text |

## Example
```ts
const file = await store.resolve('levels/mine.txt');   // { id: null, path: 'levels/mine.txt', text: '...' }
```

## Design notes
Plain data. Keeping *where* with *what* lets reports show the path and the id.
