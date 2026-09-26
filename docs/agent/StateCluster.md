# StateCluster

`packages/agent/src/StateCluster.ts` · class

Groups nearly identical exact states so the per-frame A* treats them as one
node. Each value is rounded to its tolerance; `onGround` must match exactly.

## Relationships
- used by [PerFramePlanner](PerFramePlanner.md) as its node identity
- takes a [ClusterTolerance](ClusterTolerance.md) and [PlayerState](PlayerState.md)s

## Members
| Member | Kind | Description |
|---|---|---|
| `keyOf(state, tol?)` | static method | The five rounded values joined into a string |
| `nearby(a, b, tol?)` | static method | Same key? |
| `DEFAULT_TOLERANCE` | static readonly | `{ x: 0.5, y: 0.5, vx: 5, vy: 5 }` (frozen) |

## Example
```ts
StateCluster.keyOf({ x: 100.2, y: 50, vx: 0, vy: 0, onGround: true }); // "200,100,0,0,1"
```

## Design notes
Without clustering, every sub-pixel difference would be a new A* node and
the search would never finish; with too coarse a tolerance, two states that
behave differently would be merged. `onGround` has no tolerance because
physics branches sharply on it. `Math.round` rounds halves up, which the
Python port reproduces deliberately.
