# AgentDialogOptions

`apps/editor/src/AgentDialog.ts` · interface

What an [AgentDialog](AgentDialog.md) needs. Two type aliases go with it:

- `RunAgent = (maxRuntimeMs, onProgress, signal) => Promise<LevelTestResult>`
  — run the agent within a time budget, reporting progress, until `signal` aborts;
- `AgentDialogResult = LevelTestFailure | (LevelTestSuccess & { focusedIdx? })`
  — the agent's result, or a success naming the focused solution.

## Relationships
- passed to [AgentDialog](AgentDialog.md) by [AgentController](AgentController.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `runAgent` | property | A `RunAgent`; called once per search |
| `prefs` | property | [Preferences](Preferences.md), for the minimised choice |
| `onDemo(recording)` | optional property | Demo was clicked (the dialog has closed) |
| `onResult(result, budgetMs)` | optional property | A search finished, or a solution was focused (`budgetMs` null) |
| `onClose()` | optional property | The dialog closed |

## Example
See [AgentDialog](AgentDialog.md).

## Design notes
The dialog is given a function to run rather than the agent itself, so it
knows nothing about levels, legends or engines — and could drive any search.
