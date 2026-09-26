# LevelLayout

`packages/agent/src/LevelLayout.ts` · interface

Where things are in a level: the settled spawn cell, the pickups, the exits and the grid size. Every plan carries one; the editor's overlay draws from it.

## Relationships
- returned by [LevelGrid](LevelGrid.md)`.findLayout`; implemented by [NavGraph](NavGraph.md)
- held by [Plan](Plan.md)`.graph`

## Members
| Member | Kind | Description |
|---|---|---|
| `start` | property | The cell the player settles on after spawning, or null |
| `pickupCells`, `exitCells` | properties | In row-major order |
| `width`, `height` | properties | Grid size in cells |

## Example
```ts
if (plan.graph?.start) drawMarker(plan.graph.start, 'S');
```

## Design notes
An interface both a plain object and the [NavGraph](NavGraph.md) class satisfy, so a plan can carry either and the overlay needn't care.
