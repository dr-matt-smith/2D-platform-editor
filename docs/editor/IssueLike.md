# IssueLike

`apps/editor/src/IssueSummary.ts` · interface

Anything shaped like a validation issue. Every field is optional; a missing
line or column is shown as `?`.

## Relationships
- the input of [IssueSummary](IssueSummary.md)`.of` and [ProblemsPanel](ProblemsPanel.md)`.show`;
  level-format's `ValidationIssue` satisfies it

## Members
| Member | Kind | Description |
|---|---|---|
| `line`, `col` | optional properties | 1-based position |
| `severity` | optional property | `'error'`, `'warn'`, or anything else (sorted last) |
| `message` | optional property | |

## Example
```ts
IssueSummary.of([{ severity: 'warn' }]).text; // '?:? warn '
```

## Design notes
A deliberately loose shape: the summary never crashes on partial data.
