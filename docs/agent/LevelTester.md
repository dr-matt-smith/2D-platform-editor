# LevelTester

`packages/agent/src/LevelTester.ts` · class

Answers "can this level be solved, and how?" — what the editor's Test
button and `deno task solve` call. It plans, replays the plan headless to
check that it really wins, and then looks for different routes, collecting
up to five distinct [Solution](Solution.md)s within a time budget.

## Relationships
- has a [Planner](Planner.md) (made by [PlannerFactory](PlannerFactory.md)) and a [Simulator](Simulator.md)
- creates a [SearchBudget](SearchBudget.md) per test and [Solution](Solution.md)s for each win
- returns a [LevelTestResult](LevelTestResult.md); takes [LevelTestOptions](LevelTestOptions.md)
- used by `apps/editor` (Test button) and `apps/agent-cli`

## Members
| Member | Kind | Description |
|---|---|---|
| `create(adapter, kind?)` | static method | A tester driving `adapter` with the given [PlannerKind](PlannerKind.md) (default per-frame). Throws via [AdapterGuard](AdapterGuard.md) |
| `test(parsed, legend, tileset, options?)` | async method | Plan, replay, replan and collect solutions; resolves to a [LevelTestResult](LevelTestResult.md) |
| `MAX_SOLUTIONS` | static readonly | 5 |
| `SIM_MAX_FRAMES` | static readonly | Replay budget: 2400 frames (40 s of game time) |

## Example
```ts
import { LevelTester } from '@2d-platform/agent';
import { jsAdapter } from '@2d-platform/engine';

const result = await LevelTester.create(jsAdapter).test(level, legend.toRecord(), null, {
  maxRuntimeMs: 5000,
  onProgress: (elapsed, total) => bar.value = elapsed / total,
});
if (result.ok) demo(result.solution.recording);
else console.log(result.lastPlan.unreachable);
```

## Design notes
- **The loop.** Plan once. Then, up to `replanBudget` times: replay the
  plan; if it wins, keep it (unless its recording was seen before), block
  its longest step and plan again for a different route; if it fails, ask
  the planner to `replan` around the step that was running when it failed.
  Stop at five solutions, when a new plan repeats the last recording, or
  when the budget runs out. Solutions are returned fewest frames first.
- **Composition, not inheritance.** The tester *has* a planner and a
  simulator. Swapping the planning strategy is a constructor argument, not
  a subclass.
- **A private constructor.** `create` wires the collaborators from one
  adapter, so a tester can never hold a planner and a simulator for two
  different engines.
- **Plain result data.** The result is a discriminated union of
  interfaces (check `ok`), which the editor extends with a focused index
  and the CLI turns into JSON.
- With the default per-frame planner, blocking a step does not change the
  plan (that planner ignores blocked edges), so a test usually ends with
  one solution; the bucket planner can find several.
