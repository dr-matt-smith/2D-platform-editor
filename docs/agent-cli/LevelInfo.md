# LevelInfo

`apps/agent-cli/src/LevelReport.ts` · interface

Which level a report is about.

## Relationships
- the `level` of every report ([SolvedReport](SolvedReport.md), [UnsolvedReport](UnsolvedReport.md), [InvalidReport](InvalidReport.md))
- built by [LevelSolver](LevelSolver.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `id` | property | Manifest id, or `null` for a path |
| `name` | property | `# name:`, else the id, else the file name |
| `path` | property | Where it was read from |
| `tileset` | property | The declared tileset |
| `width`, `height` | properties | Grid size in cells |

## Example
```ts
report.level.name;   // 'tutorial'
```

## Design notes
Plain data; part of the JSON contract.
