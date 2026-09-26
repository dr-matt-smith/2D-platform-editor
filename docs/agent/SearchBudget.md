# SearchBudget

`packages/agent/src/SearchBudget.ts` · class

The wall-clock budget of one level test: reports progress, says whether to
carry on, and yields to the event loop between steps so a browser page stays
responsive and a Cancel button can abort the search.

## Relationships
- created by [LevelTester](LevelTester.md)`.test` from its [LevelTestOptions](LevelTestOptions.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new SearchBudget(maxRuntimeMs, onProgress?, signal?)` | constructor | Starts the clock |
| `maxRuntimeMs` | readonly property | The budget |
| `elapsedMs` | get accessor | Milliseconds since creation |
| `tick()` | async method | Report progress; `false` if aborted or out of time, otherwise yield and return `true` |

`ProgressListener` (same file) is the callback type:
`(elapsedMs, maxRuntimeMs) => void`.

## Example
```ts
const budget = new SearchBudget(5000, onProgress, signal);
while (moreToDo) {
  step();
  if (!(await budget.tick())) break;
}
```

## Design notes
Extracting the budget from the tester's loop gives the timing rules one
home and one test file. `tick` reports progress *before* checking the
abort signal, so a listener always sees the final elapsed time.
