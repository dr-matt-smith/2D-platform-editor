# Simulator

`packages/agent/src/Simulator.ts` · class

Replays a recording on a level, headless, and reports how it ended — the
check that a plan really solves the level.

## Relationships
- holds a [PhysicsAdapter](PhysicsAdapter.md), which makes the [SceneHandle](SceneHandle.md) and [ScriptedInputHandle](ScriptedInputHandle.md)
- returns a [SimResult](SimResult.md); takes [SimulatorRunOptions](SimulatorRunOptions.md)
- used by [LevelTester](LevelTester.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new Simulator(adapter)` | constructor | |
| `run(parsed, legend, recording?, options?)` | method | Step a fresh scene until the player wins, dies or the frame budget runs out |
| `DEFAULT_DT` | static readonly | 1/60 s |
| `DEFAULT_MAX_FRAMES` | static readonly | 600 (ten seconds) |

## Example
```ts
const sim = new Simulator(jsAdapter).run(level, legend, plan.recording, { maxFrames: 2400 });
if (sim.outcome === SimOutcome.Dead) console.log('died at', sim.pos, 'on frame', sim.frame);
```

## Design notes
- **Dependency injection.** The simulator is given its engine; it never
  imports one. The same class replays on the JS engine or a stub.
- **Explicit frame clock.** Each frame it calls `input.advance(frame)`
  and then `scene.update(dt)`, in that order — the same order the golden
  vector generator uses, so JS and Python replays agree frame for frame.
