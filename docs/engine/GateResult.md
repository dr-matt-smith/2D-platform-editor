# GateResult

`packages/engine/src/GateResult.ts` · interface

Whether a level may be played, and if not, why.

## Relationships
- returned by [PlaytestGate](PlaytestGate.md)`.check`
- extended by [PlaytestLaunch](PlaytestLaunch.md)
- `reasons` are level-format `ValidationIssue`s

## Members
| Member | Kind | Description |
|---|---|---|
| `ok` | property | May it be played? |
| `reasons` | property | The blocking issues (empty when `ok`) |

## Example
```ts
const { ok, reasons } = new PlaytestGate().check(level);
```

## Design notes
Reasons use the validator's issue shape, so the editor shows them in its
problems panel like any other issue.
