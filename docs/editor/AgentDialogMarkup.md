# AgentDialogMarkup

`apps/editor/src/AgentDialogMarkup.ts` · class

The HTML for each state of the [AgentDialog](AgentDialog.md): searching,
success, success minimised, and failure. Pure — data in, markup out — so
every state is unit-tested without a page. Buttons carry a `data-act` the
dialog dispatches on (`close`, `demo`, `focus-N`, `minimise`, `expand`,
`try10`…).

## Relationships
- used by [AgentDialog](AgentDialog.md)
- reads agent's `Solution` and `LevelTestFailure`; compares with agent's `GoalKind` and `SimOutcome`

## Members
| Member | Kind | Description |
|---|---|---|
| `ESCALATION_BUDGETS_MS` | static readonly | `[10000, 15000, 20000]` |
| `searching(budgetMs)` | static method | Countdown and progress bar |
| `success(solutions, focusedIdx?)` | static method | A row per solution, and the focused one's trace |
| `minimised(solutions, focusedIdx?)` | static method | The thin results bar |
| `failure(result, budgetMs)` | static method | Why, and buttons for the longer budgets |
| `failureReason(result)` | static method | The "why" sentence |

## Example
```ts
backdrop.innerHTML = AgentDialogMarkup.failure(result, 5000); // offers Try 10s / 15s / 20s
```

## Design notes
A class of static methods groups the four templates under one name without
pretending they have state. Separating *what it looks like* from *how it
behaves* is what makes the dialog's content testable.
