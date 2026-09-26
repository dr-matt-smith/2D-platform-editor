# ActionSimulator

`packages/agent/src/ActionSimulator.ts` · class

Answers "if the player is in exactly this state and performs this action,
where does it end up?" by running the real engine through the adapter. It
is the planners' source of truth: every edge they search over comes from
here.

## Relationships
- holds a [PhysicsAdapter](PhysicsAdapter.md) and one [SceneHandle](SceneHandle.md)
- simulates an [Action](Action.md) from a [PlayerState](PlayerState.md); returns an [ActionResult](ActionResult.md)
- used by [NavGraph](NavGraph.md), [PerFrameExpander](PerFrameExpander.md) and [BucketPlanner](BucketPlanner.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `create(adapter, parsed, legend, tileset?)` | static method | A simulator over a fresh scene |
| `simulate(startState, action, options?)` | method | Reset the scene, set the player to `startState`, play the action; see [SimulateActionOptions](SimulateActionOptions.md) |

## Example
```ts
const sim = ActionSimulator.create(jsAdapter, level, legend);
const r = sim.simulate({ x: 20, y: 40, vx: 0, vy: 0, onGround: true }, new JumpAction(Direction.Right, 12));
console.log(r.outcome, r.endCell, r.cost);
```

## Design notes
- **One scene, reused.** Building a scene is the expensive part, so the
  simulator keeps one and resets it (phase, score, coins, clocks) before
  each simulation. A planner runs thousands of simulations on one object.
- **Polymorphism instead of a kind switch.** How long to run comes from
  `action.nominalCost` and `action.leavesGround`: a walk runs one frame
  past its cost (so the release lands), an action that leaves the ground
  gets 30 extra frames and stops on landing.
- **Frame-exact with a replay.** The action's recording starts at frame 1,
  as a plan's does, and the input is advanced explicitly before each
  update — so a chain of simulated actions replays on the engine exactly.
