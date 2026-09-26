# ValidationIssue

`packages/level-format/src/ValidationIssue.ts` · interface

One problem found in a level, with a position in the original text.

## Relationships
- produced by [LevelValidator](LevelValidator.md) (and [Level](Level.md)`.validate`)
- has a [Severity](Severity.md)
- also used by the engine's playtest gate, the editor's problems panel, the player and the agent CLI, which create their own issues of the same shape

## Members
| Member | Kind | Description |
|---|---|---|
| `line` | property | 1-based line in the text (1 for whole-level issues) |
| `col` | property | 1-based column (1 for whole-level issues) |
| `severity` | property | [Severity](Severity.md) |
| `message` | property | Human-readable description |

## Example
```ts
{ line: 2, col: 2, severity: Severity.Error, message: "undefined glyph 'Z'" }
```

## Design notes
An interface rather than a class: an issue is plain data that several
packages create and pass around, and object literals of this shape are the
simplest way to do that.
