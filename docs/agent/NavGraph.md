# NavGraph

`packages/agent/src/NavGraph.ts` · class

The bucket planner's search graph. Each walkable cell becomes nine nodes
(3 speed buckets x 3 x-offset buckets), keyed by [StateKey](StateKey.md)
text; each edge is a candidate action that was simulated from the node and
landed cleanly.

## Relationships
- implements [LevelLayout](LevelLayout.md) (so a plan can carry it as its `graph`)
- holds [NavNode](NavNode.md)s and [NavEdge](NavEdge.md)s; `findPath` returns [NavPathStep](NavPathStep.md)s
- built with an [ActionSimulator](ActionSimulator.md), a [LevelGrid](LevelGrid.md) and the [ActionCatalog](ActionCatalog.md)
- used by [BucketPlanner](BucketPlanner.md) and [PickupTour](PickupTour.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `build(adapter, parsed, legend?, tileset?)` | static method | Make the nodes, then simulate every candidate from every grounded left-third node |
| `nodes` | readonly property | `Map` of StateKey text → [NavNode](NavNode.md) |
| `edges` | readonly property | `Map` of StateKey text → [NavEdge](NavEdge.md)[] |
| `start`, `pickupCells`, `exitCells`, `width`, `height` | readonly properties | The [LevelLayout](LevelLayout.md) |
| `hasNode(key)` | method | Is there such a node? |
| `edgesFrom(key)` | method | The edges leaving a node |
| `findPath(from, to, blocked?)` | method | A* from a StateKey to any node in cell "r,c", skipping blocked edge ids; `[]` if already there, null if no path |
| `pathCost(path)` | static method | Total frames of a path |

## Example
```ts
const graph = NavGraph.build(jsAdapter, level, legend);
const path = graph.findPath('1,1,0,L', '1,10');
console.log(path && NavGraph.pathCost(path));
```

## Design notes
- **Correct by construction.** The planner picks actions and physics says
  where they end up, so every edge is one the engine can reproduce.
- **One scene, thousands of simulations.** `build` makes one
  [ActionSimulator](ActionSimulator.md) and reuses it; a level with no
  spawn gets nodes but no edges.
- **Only left-third nodes get edges**, and every edge arrives at a
  left-third node, so chains always start from whole-pixel positions. The
  other nodes exist but stay empty; exact sub-pixel states are the
  [PerFramePlanner](PerFramePlanner.md)'s job.
- **Why a private constructor.** A graph is only meaningful once it has
  been simulated; the static `build` is the one way to get one.
- The A* heuristic is Manhattan distance times 5 frames (one cell of
  walking), which never overestimates.
