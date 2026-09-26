# Legend

`packages/level-format/src/Legend.ts` · class

A tileset's glyph legend: which characters may appear in a level grid, and
for each one its name, [Role](Role.md) and swatch. Everything role-driven —
validation, the engine's world builder, the renderer's decoration passes —
asks a `Legend` what a glyph does rather than testing the character itself.

## Relationships
- holds [LegendEntry](LegendEntry.md)s, one per glyph (aggregation)
- built from a [GlyphLookup](GlyphLookup.md) (`fromLookup`), resolving each [GlyphDef](GlyphDef.md)'s role
- implements `Iterable<[glyph, LegendEntry]>`
- used by [LevelValidator](LevelValidator.md) and [Level](Level.md)`.findCells`
- converts to and from a plain `LegendRecord` for the agent package

## Members
| Member | Kind | Description |
|---|---|---|
| `DEFAULT` | static readonly | The Dirt glyph set (`. # P ^ o E`): the offline fallback and the validator's default |
| `fromLookup(lookup)` | static method | Build from a `tile_lookup.json`; no `glyphs` gives `DEFAULT` |
| `fromRecord(record)` | static method | Build from a plain glyph → entry object; missing names default to the glyph; `null` gives an empty legend |
| `size` | get accessor | Number of glyphs |
| `has(glyph)` | method | Is the glyph in the legend? |
| `get(glyph)` | method | Its [LegendEntry](LegendEntry.md), or `undefined` |
| `roleOf(glyph)` | method | Its [Role](Role.md), or `null` if not in the legend |
| `glyphs()` | method | All glyphs, in legend order |
| `glyphsWithRole(role)` | method | The glyphs that have `role` |
| `entries()` | method | `[glyph, entry]` pairs |
| `[Symbol.iterator]()` | method | Makes `for (const [g, e] of legend)` work |
| `toRecord()` | method | The legend as a frozen plain object (`LegendRecord`) |

`LegendRecord` (in `LegendEntry.ts`) is the type of that plain object:
glyph → an entry where only `role` is required.

## Example
```ts
import { Legend, Role } from '@2d-platform/level-format';

const legend = Legend.fromLookup({
  glyphs: {
    player: { char: '@', name: 'Hero', role: 'entity' }, // legacy role: the key decides
    apple: { char: 'o', name: 'Apple', role: 'pickup' },
  },
});
legend.roleOf('@');   // Role.Player
legend.roleOf('o');   // Role.Pickup
legend.roleOf('Z');   // null — not in the legend

for (const [glyph, entry] of Legend.DEFAULT) console.log(glyph, entry.name);
```

## Design notes
- **Encapsulation.** The glyph map is a `private readonly` field, frozen in
  the constructor; callers use `has` / `get` / `roleOf` and cannot change a
  legend after it is built.
- **Named static factories** (`fromLookup`, `fromRecord`) say where a legend
  comes from; the constructor is `private`.
- **A shared default instance.** `Legend.DEFAULT` is a `static readonly`
  field — one immutable object that everyone can share safely.
- **Iterable.** Implementing `Symbol.iterator` lets a legend be used in
  `for…of` and spread (`[...legend]`) like a built-in collection.
- **Legacy data.** Old tilesets use coarse roles (`'entity'`) and put the
  meaning in the glyph's key (`glyphs.player`). The private `resolveRole`
  lets those keys win, so no data needs migrating; an unrecognised role
  becomes `Role.Unknown` and the glyph is simply inert.
- **Plain object inside, not a `Map`.** Iteration then keeps the exact order
  the editor's legend panel has always shown.
- **Crossing a boundary.** The agent package may not import this one, so it
  receives `legend.toRecord()`; the engine's `jsAdapter` rebuilds a `Legend`
  with `Legend.fromRecord`.
