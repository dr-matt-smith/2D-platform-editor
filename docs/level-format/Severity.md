# Severity

`packages/level-format/src/Severity.ts` · enum

How serious a [ValidationIssue](ValidationIssue.md) is.

## Relationships
- the `severity` of every [ValidationIssue](ValidationIssue.md)
- set by [LevelValidator](LevelValidator.md); the engine's playtest gate blocks on `Error`

## Members
| Member | Kind | Description |
|---|---|---|
| `Error` = `'error'` | enum member | The level cannot be played until it is fixed |
| `Warn` = `'warn'` | enum member | Worth knowing, but the level still loads (e.g. no exit yet) |

## Example
```ts
const blocking = issues.filter((i) => i.severity === Severity.Error);
```

## Design notes
A string enum whose values are what the apps display and style against
(the editor's `data-severity` attribute), so the UI is unchanged.
