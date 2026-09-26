# LevelTestResult

`packages/agent/src/LevelTestResult.ts` · type alias

What [LevelTester](LevelTester.md)`.test` returns: [LevelTestSuccess](LevelTestSuccess.md) or [LevelTestFailure](LevelTestFailure.md).

## Relationships
- a union of [LevelTestSuccess](LevelTestSuccess.md) and [LevelTestFailure](LevelTestFailure.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `ok` | discriminant | `true` for success, `false` for failure |

## Example
```ts
const r = await tester.test(level, legend, null);
if (r.ok) show(r.solutions);
else explain(r.lastPlan, r.lastSim);
```

## Design notes
A discriminated union: checking `ok` narrows the type, so the compiler knows which fields exist.
