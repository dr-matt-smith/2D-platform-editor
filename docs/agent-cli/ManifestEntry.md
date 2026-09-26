# ManifestEntry

`apps/agent-cli/src/ManifestEntry.ts` · interface

One row of `levels/manifest.json`.

## Relationships
- returned by [ContentStore](ContentStore.md)`.readManifest()`; read by `loadBundled`

## Members
| Member | Kind | Description |
|---|---|---|
| `id` | property | The level id used on the command line |
| `name` | property | Display name |
| `file` | property | File under `levels/` |
| `group` | optional property | Picker heading (unused here) |

## Example
```ts
const [first] = await store.readManifest();   // { id: 'tutorial', name: 'tutorial', file: 'tutorial.txt' }
```

## Design notes
Mirrors the manifest file. Rows are checked with a type guard before they are trusted.
