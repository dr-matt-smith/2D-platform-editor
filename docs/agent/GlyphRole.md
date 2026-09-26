# GlyphRole

`packages/agent/src/GlyphRole.ts` · enum

The glyph roles the agent cares about.

## Relationships
- returned (as strings) by [LevelGrid](LevelGrid.md)`.glyphRole` / `roleAt`

## Members
| Member | Value | Meaning |
|---|---|---|
| `Terrain` | `'terrain'` | Solid; the player stands on it |
| `Hazard` | `'hazard'` | Kills on touch |
| `Player` | `'player'` | The spawn |
| `Exit` | `'exit'` | A goal |
| `Pickup` | `'pickup'` | Collectable |

## Example
```ts
if (grid.roleAt(r, c) === GlyphRole.Exit) exits.push({ r, c });
```

## Design notes
level-format has its own `Role` enum with these values (and more), but the
agent may not import other packages. The values match, so a legend record
from level-format works unchanged; `roleAt` returns `string | null`
because a legend can hold roles the agent ignores (e.g. 'background').
