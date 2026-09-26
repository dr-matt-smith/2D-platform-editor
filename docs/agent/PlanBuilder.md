# PlanBuilder

`packages/agent/src/PlanBuilder.ts` · class

Writes a [Plan](Plan.md) step by step — the key recording, the explained
trace and the step counts — so both planners press keys the same way.

## Relationships
- used by [PerFramePlanner](PerFramePlanner.md) and [BucketPlanner](BucketPlanner.md)
- builds a [Plan](Plan.md) of [TraceEntry](TraceEntry.md)s and [RecordingEvent](RecordingEvent.md)s

## Members
| Member | Kind | Description |
|---|---|---|
| `currentFrame` | get accessor | The frame the next step starts on (starts at 1) |
| `heldDirection` | get accessor | The direction key held down, or null |
| `holdDirection(dir)` | method | Hold `dir`, releasing the other direction first; no event if already held |
| `tapJump()` | method | Space down now, up next frame |
| `releaseDirectionAfter(offset, stepCost)` | method | Release the held direction `offset` frames in, if held and `offset < stepCost` |
| `addStep(kind, target, why, cost, edgeId)` | method | Count the step, add its trace entry, advance the clock by `cost` |
| `releaseHeldDirection()` | method | Release the held direction now (end of plan) |
| `build(graph, goals, unreachable)` | method | The plan written so far |

## Example
```ts
const b = new PlanBuilder();
b.holdDirection(Direction.Right);
b.tapJump();
b.releaseDirectionAfter(12, 40);
b.addStep(ActionKind.Jump, { r: 3, c: 7 }, 'jump right toward exit at (7,3)', 40, id);
b.releaseHeldDirection();
const plan = b.build(layout, goals, []);
```

## Design notes
- **Encapsulated state.** The recording, trace, frame clock and held key
  are private; callers can only change them through operations that keep
  the recording well-formed (a key is never pressed twice).
- **Frame 1, not 0.** The player spawns in mid-air and needs one update to
  land; a jump pressed on frame 0 would be ignored.
- **One place for shared rules, planners keep their own.** Both planners
  hold directions and tap jumps identically; *when* to release differs
  between them, so they call `releaseDirectionAfter` themselves.
