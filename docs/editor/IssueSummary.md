# IssueSummary

`apps/editor/src/IssueSummary.ts` · class

A one-line summary of validation issues for the message bar: the most
serious issue as `line:col severity message`, plus `· +N more`. Errors come
before warnings; within a severity the first issue wins.

## Relationships
- built from [IssueLike](IssueLike.md) values (level-format's `ValidationIssue` fits)
- used by [ProblemsPanel](ProblemsPanel.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `OK` | static readonly | `'ok'`, the severity when there are no issues |
| `of(issues)` | static method | Summarise `issues` (null or empty → `OK`) |
| `new IssueSummary(text, severity)` | constructor | |
| `text` | readonly property | The line to show |
| `severity` | readonly property | The head issue's severity, or `'ok'` |

## Example
```ts
IssueSummary.of([
  { line: 1, col: 1, severity: Severity.Warn, message: 'no exit in level' },
  { line: 7, col: 2, severity: Severity.Error, message: 'real problem' },
]);
// IssueSummary { text: '7:2 error real problem · +1 more', severity: 'error' }
```

## Design notes
An immutable value object with a static factory: easy to compare in tests,
impossible to half-build.
