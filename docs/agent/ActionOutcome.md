# ActionOutcome

`packages/agent/src/ActionOutcome.ts` · enum

How one simulated action ended.

## Relationships
- the `outcome` of an [ActionResult](ActionResult.md) from [ActionSimulator](ActionSimulator.md)

## Members
| Member | Value | Meaning |
|---|---|---|
| `Ok` | `'ok'` | Finished standing on something |
| `MidAir` | `'mid-air'` | Finished still in the air |
| `Dead` | `'dead'` | Died |
| `Won` | `'won'` | Won the level on the way |

## Example
```ts
if (result.outcome !== ActionOutcome.Ok && result.outcome !== ActionOutcome.Won) continue;
```

## Design notes
Separate from [SimOutcome](SimOutcome.md): an action can end in mid-air,
a whole replay cannot.
