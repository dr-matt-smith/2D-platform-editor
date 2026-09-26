# FailureReason

`packages/agent/src/FailureReason.ts` · enum

Why a level test stopped early, when it did.

## Relationships
- the optional `reason` of a [LevelTestFailure](LevelTestFailure.md)

## Members
| Member | Value | Meaning |
|---|---|---|
| `TimeoutDuringPlan` | `'timeout-during-plan'` | The budget ran out (or the test was aborted) while the first plan was being made |

## Example
```ts
if (!result.ok && result.reason === FailureReason.TimeoutDuringPlan) suggestLargerBudget();
```

## Design notes
A one-member enum still names the case and leaves room for more; the CLI
checks it to suggest a larger `--budget`.
