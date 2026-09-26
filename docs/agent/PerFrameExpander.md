# PerFrameExpander

`packages/agent/src/PerFrameExpander.ts` · class

Generates the per-frame planner's edges on demand: from an exact
[PlayerState](PlayerState.md), simulate all 46 candidate actions and keep
the ones that land cleanly. Each edge carries the exact state it ends in.

## Relationships
- has an [ActionSimulator](ActionSimulator.md), built lazily on the first expansion
- reads cells through a [LevelGrid](LevelGrid.md); tries the actions of [ActionCatalog](ActionCatalog.md)
- returns [PerFrameEdge](PerFrameEdge.md)s; configured by [PerFrameTargets](PerFrameTargets.md)
- used by [PerFramePlanner](PerFramePlanner.md)`.findPath`

## Members
| Member | Kind | Description |
|---|---|---|
| `new PerFrameExpander(adapter, parsed, legend, tileset?, targets?)` | constructor | One expander per level and plan |
| `expand(state)` | method | Every edge from exactly `state` |
| `hasScene` | get accessor | Has the scene been built yet? |

## Example
```ts
const expander = new PerFrameExpander(jsAdapter, level, legend, null, { exitCells });
for (const edge of expander.expand(state)) console.log(edge.kind, edge.dir, edge.toCell);
```

## Design notes
- **Which edges survive.** An action is kept if it ends standing on a
  walkable cell, or touches an exit on the way (a win edge, pointed at
  that exit). Actions that die, end in mid-air or push against a wall are
  dropped.
- **Precision landings.** A one-tile pickup can be flown through without
  being the landing cell. If an arc passes within 2 px of a target's
  centre while descending, an extra edge to that target is added.
- **Lazy, cached collaborator.** Building a scene is the expensive part,
  so the simulator is made once, on first use, and reused for every
  expansion — the object owns its cache instead of a caller passing one in.
