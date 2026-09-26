# StateKey

`packages/agent/src/StateKey.ts` · class

The identity of a [NavGraph](NavGraph.md) node: a cell plus a coarse
description of how the player moves through it — a horizontal-speed bucket
(-1, 0, +1) and which third of the cell it is in
([XOffsetBucket](XOffsetBucket.md)). Its text form "r,c,vx,xo" keys the
graph's maps.

## Relationships
- used by [NavGraph](NavGraph.md), [PickupTour](PickupTour.md) and [BucketPlanner](BucketPlanner.md)
- has an [XOffsetBucket](XOffsetBucket.md); `cell` is a [Cell](Cell.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `of(r, c, vxBucket?, xOffsetBucket?)` | static method | A key (default: still, left third) |
| `parse(text)` | static method | Read "r,c,vx,xo" back; throws on a malformed key |
| `ofState(state)` | static method | The key an exact [PlayerState](PlayerState.md) falls in |
| `vxBucketOf(vx)` | static method | -1, 0 or +1; \|vx\| < 30 counts as still |
| `xOffsetBucketOf(x)` | static method | Which third of its cell an AABB-left x is in |
| `bucketCentreX(c, xOffsetBucket)` | static method | A representative x for a bucket of column `c` |
| `VX_BUCKETS`, `X_OFFSET_BUCKETS` | static readonly | The buckets, in node order |
| `r`, `c`, `vxBucket`, `xOffsetBucket` | readonly properties | The parts |
| `cell` | get accessor | `{ r, c }` |
| `toString()` | method | "r,c,vx,xo", e.g. "5,7,1,L" |

## Example
```ts
StateKey.of(5, 7, 1).toString();                    // "5,7,1,L"
StateKey.parse('5,7,-1,R').xOffsetBucket;           // XOffsetBucket.Right
StateKey.ofState({ x: 28, y: 40, vx: 240, vy: 0, onGround: true }).toString(); // "2,1,1,C"
```

## Design notes
- **A value object.** Immutable, created only through static factories
  (the constructor is private), and compared by its text form.
- **Maps are keyed by the text.** JavaScript `Map`s compare objects by
  identity, so two equal keys made separately would be different map
  keys; the string form makes equal keys equal.
- **Why nine nodes per cell.** The speed bucket alone wasn't enough: two
  states with the same speed but a different sub-cell x can land on
  different cells after a chained jump.
