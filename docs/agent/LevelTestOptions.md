# LevelTestOptions

`packages/agent/src/LevelTester.ts` · interface

Options for [LevelTester](LevelTester.md)`.test`.

## Relationships
- taken by [LevelTester](LevelTester.md)`.test`; turned into a [SearchBudget](SearchBudget.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `maxRuntimeMs?` | property | Wall-clock budget (default 5000) |
| `onProgress?` | property | `(elapsedMs, maxRuntimeMs) => void`, called between steps |
| `signal?` | property | An `AbortSignal` to stop early |
| `replanBudget?` | property | Most plan-then-replay attempts (default 10) |

## Example
```ts
tester.test(level, legend, null, { maxRuntimeMs: 10_000, signal: controller.signal });
```

## Design notes
The adapter is no longer an option: it is fixed when the tester is created.
