# LevelTestSuccess

`packages/agent/src/LevelTestResult.ts` · interface

The level can be solved.

## Relationships
- one side of [LevelTestResult](LevelTestResult.md); holds [Solution](Solution.md)s

## Members
| Member | Kind | Description |
|---|---|---|
| `ok` | property | `true` |
| `solutions` | property | Up to 5 distinct solutions, fewest frames first |
| `solution` | property | The best (`solutions[0]`) |

## Example
```ts
if (result.ok) demo(result.solution.recording);
```

## Design notes
An interface rather than a class, so the editor can extend it (`LevelTestSuccess & { focusedIdx }`) with an object literal.
