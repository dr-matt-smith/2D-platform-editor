# PreparedLevel

`apps/agent-cli/src/PreparedLevel.ts` · interface

A level ready to solve: the [LevelFile](LevelFile.md), parsed, with the legend of its tileset.

## Relationships
- extends [LevelFile](LevelFile.md)
- made by [ContentStore](ContentStore.md)`.prepare()`; solved by [LevelSolver](LevelSolver.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `parsed` | property | The level-format `Level` |
| `legend` | property | The level-format `Legend` to validate and solve with |
| `tilesetWarning` | property | Set when the declared tileset was unusable, else `null` |

## Example
```ts
const level: PreparedLevel = await store.prepare(file);
await solver.solve(level, 5000);
```

## Design notes
Interface inheritance: a prepared level *is* a level file with more known about it.
