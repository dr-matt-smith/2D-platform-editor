# Role

`packages/level-format/src/Role.ts` · enum

What a glyph *does* in a level. Every rule in the program keys off a
glyph's role, looked up in a [Legend](Legend.md), rather than the character
itself.

## Relationships
- the `role` of every [LegendEntry](LegendEntry.md)
- returned by [Legend](Legend.md)`.roleOf`; taken by [Level](Level.md)`.findCells`
- checked by [LevelValidator](LevelValidator.md) (`Player`, `Exit`), the engine (`Terrain`, `Player`, `Hazard`, `Pickup`, `Exit`) and the renderer (`Decoration`, `Foreground`)

## Members
| Member | Kind | Description |
|---|---|---|
| `Background` = `'background'` | enum member | Empty space |
| `Terrain` = `'terrain'` | enum member | Solid ground |
| `Player` = `'player'` | enum member | The player's spawn (exactly one per level) |
| `Exit` = `'exit'` | enum member | Reaching it wins (once the pickup rule is met) |
| `Hazard` = `'hazard'` | enum member | Touching it loses |
| `Pickup` = `'pickup'` | enum member | Collectable |
| `Decoration` = `'decoration'` | enum member | Visual only, drawn under the entities |
| `Foreground` = `'foreground'` | enum member | Visual only, drawn over the entities |
| `Unknown` = `'unknown'` | enum member | Never written in data: a glyph whose declared role was not recognised |
| `KNOWN_ROLES` | exported constant | `ReadonlySet<Role>` — every role except `Unknown` |
| `isKnownRole(value)` | exported function | Type guard: is `value` a declarable role string? |

## Example
```ts
switch (legend.roleOf(glyph)) {
  case Role.Terrain: /* build a platform */ break;
  case Role.Hazard:  /* build a spike */    break;
  default:           /* inert */            break;
}
```

## Design notes
- **String enum matching the data.** The values are the exact strings in
  `tile_lookup.json`, so tilesets and saved data did not change.
- **`Unknown` is a member, not `null`.** An unrecognised role still *is* a
  role — "inert" — and no rule matches it, so a typo in a tileset cannot
  break a level. `null` is kept for "this glyph is not in the legend at all",
  which the validator reports.
- The set and type guard sit beside the enum because TypeScript enums
  cannot hold methods.
