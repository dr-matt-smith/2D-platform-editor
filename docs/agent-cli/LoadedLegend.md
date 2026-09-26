# LoadedLegend

`apps/agent-cli/src/LoadedLegend.ts` · interface

The legend to solve with, plus a warning if the tileset was unusable.

## Relationships
- returned by [ContentStore](ContentStore.md)`.loadLegend()`

## Members
| Member | Kind | Description |
|---|---|---|
| `legend` | property | A level-format `Legend` |
| `warning` | property | "unknown tileset 'X', using default", or `null` |

## Example
```ts
const { legend, warning } = await store.loadLegend('Remapped');
```

## Design notes
Returning the warning as data (not printing it) lets it end up in the report's `warnings`.
