# Level

`packages/level-format/src/Level.ts` · class

A parsed level: the padded grid, the header values (`meta`) and the rows as
written. It is what the rest of the program means by "a level" — the
editor draws it, the engine builds a world from it, the validator checks it.

## Relationships
- implements [LevelData](LevelData.md) (so it has `meta`, `grid`, `rows`)
- created by `Level.parse` / `Level.create`, and by [LevelText](LevelText.md)`.parse()`
- uses [Legend](Legend.md) and [Role](Role.md) in `findCells`
- delegates `validate` to [LevelValidator](LevelValidator.md)
- returns a [PickupRequirement](PickupRequirement.md) from `pickupRequirement`
- its `meta` holds a [Theme](Theme.md), [Dimensions](Dimensions.md) and a `PickupRequired`

## Members
| Member | Kind | Description |
|---|---|---|
| `BACKGROUND_GLYPH` | static readonly | `'.'` — the glyph that pads short rows |
| `DEFAULT_TILESET` | static readonly | `'Dirt_Platformer_Tiles'` — used when there is no `# tileset:` |
| `VIEWPORT_MIN`, `VIEWPORT_MAX` | static readonly | `4`, `200` — the range `# viewport:` sizes are clamped to |
| `parse(text)` | static method | Parse level text. Never throws: malformed values fall back to defaults |
| `create(grid, meta?)` | static method | Build a level from rows plus any header values; the rest are defaults |
| `clampViewport(n)` | static method | Clamp and round a viewport size into range |
| `isComment(line)` | static method | True for a `//` comment line |
| `meta` | readonly property | The [LevelMeta](LevelMeta.md) |
| `grid` | readonly property | Equal-width rows of glyphs |
| `rows` | readonly property | The [LevelRow](LevelRow.md)s as written, with file line numbers |
| `name`, `tileset`, `theme`, `width`, `height` | get accessors | Shortcuts into `meta` |
| `pickupRequirement` | get accessor | `meta.pickupRequired` as a [PickupRequirement](PickupRequirement.md) |
| `cellAt(col, row)` | method | The glyph at a cell, or `undefined` off the grid |
| `findCells(role, legend?)` | method | Every [GridPosition](GridPosition.md) whose glyph has `role` |
| `validate(legend?)` | method | The level's [ValidationIssue](ValidationIssue.md)s |
| `serialize()` | method | Canonical text (non-default directives, then the grid) |
| `toString()` | method | Same as `serialize()` |

## Example
```ts
import { Level, Role } from '@2d-platform/level-format';

const level = Level.parse('# name: demo\n#####\n#P.E#\n#####');
level.name;                    // 'demo'
level.width;                   // 5
level.cellAt(1, 1);            // 'P'
level.findCells(Role.Exit);    // [{ col: 3, row: 1 }]
level.validate();              // [] — one player, an exit, no unknown glyphs
level.serialize();             // '# name: demo\n#####\n#P.E#\n#####'
```

## Design notes
- **Static factory instead of a public constructor.** Parsing turns
  untrusted text into a valid object, so it is a named factory
  (`Level.parse`). The constructor is `private`: every `Level` comes from
  `parse` or `create`, which both pad the grid and fill in width and height,
  so a `Level` is always consistent.
- **Private static helpers** (`applyDirective`, `parseViewport`,
  `defaultMeta`) break parsing into small named steps without exposing them.
- **Immutable.** `meta`, `grid` and `rows` are `readonly`; nothing changes a
  level after it is made. To edit, change the text ([LevelText](LevelText.md))
  and parse again.
- **Interface and class.** `Level` *implements* [LevelData](LevelData.md).
  Code that only reads level data depends on the interface; code that wants
  the behaviour uses the class.
- **Constants live on the class** they belong to (`Level.DEFAULT_TILESET`)
  rather than as loose module exports.
- `toString()` is overridden, so a level can be used directly in a template
  string.
