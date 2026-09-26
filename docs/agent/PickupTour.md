# PickupTour

`packages/agent/src/PickupTour.ts` · class

Chooses which pickups the bucket planner visits, and in what order, to keep
the whole route short. Costs are real A* path costs over a
[NavGraph](NavGraph.md).

## Relationships
- used by [BucketPlanner](BucketPlanner.md); searches a [NavGraph](NavGraph.md)
- reads the level's [PickupRequired](ParsedLevel.md) setting

## Members
| Member | Kind | Description |
|---|---|---|
| `resolve(graph, requiredPickups)` | static method | The goal queue as "r,c" keys: chosen pickups in order, then the first exit. Empty with no exit |

## Example
```ts
PickupTour.resolve(graph, 'all');  // ['1,3', '1,4', '1,5', '1,6', '1,8']
PickupTour.resolve(graph, 0);      // ['1,8']
```

## Design notes
- **The rules.** Up to 4 pickups: try every order (at most 24). More than
  4: nearest first, then improve by swapping pairs (2-opt, at most 50
  rounds). N of M required: try every combination of N, each ordered as
  above. Pickups with no path from the start are left out, so the planner
  still tries the exit.
- **One public entry, private helpers.** The instance holds the graph,
  start and exit so the helper methods don't pass them around; the only
  way in is the static `resolve`.
- **Generators.** `combinations` and `permutations` are generator methods,
  so orders are produced one at a time instead of built into a big array.
- Every leg is costed from the still, left-third node of its start cell —
  an approximation, but a consistent one.
