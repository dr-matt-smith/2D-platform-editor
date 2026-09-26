# XOffsetBucket

`packages/agent/src/XOffsetBucket.ts` · enum

Which third of its cell the player's AABB left edge is in.

## Relationships
- part of a [StateKey](StateKey.md) and a [NavNode](NavNode.md); computed by `StateKey.xOffsetBucketOf`

## Members
| Member | Value | Meaning |
|---|---|---|
| `Left` | `'L'` | [0, TILE/3) |
| `Centre` | `'C'` | [TILE/3, 2·TILE/3) |
| `Right` | `'R'` | [2·TILE/3, TILE) |

## Example
```ts
StateKey.xOffsetBucketOf(28); // XOffsetBucket.Centre (28 mod 20 = 8)
```

## Design notes
The values are the letters in a StateKey's text ("5,7,1,L"), so keys read
the same as before the restructure.
