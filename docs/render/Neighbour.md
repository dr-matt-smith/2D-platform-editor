# Neighbour

`packages/render/src/Neighbour.ts` · enum

The four orthogonal neighbours of a grid cell, listed clockwise from North —
the order of the bits in a [TerrainMask](TerrainMask.md).

## Relationships
- taken by [TerrainMask](TerrainMask.md)`.has`; each maps to one mask bit

## Members
| Member | Kind | Description |
|---|---|---|
| `North` = `'north'` | enum member | Bit 1 |
| `East` = `'east'` | enum member | Bit 2 |
| `South` = `'south'` | enum member | Bit 4 |
| `West` = `'west'` | enum member | Bit 8 |

## Example
```ts
if (!mask.has(Neighbour.North)) { /* open sky above: grass goes here */ }
```

## Design notes
A string enum like every other enum in the project; the bit values live in
a private table in [TerrainMask](TerrainMask.md), so the enum names *sides*
and the mask owns the arithmetic.
