# LevelMeta

`packages/level-format/src/LevelData.ts` · interface

A level's header directives with their defaults filled in, plus the grid's
size. Every field is always present after parsing.

## Relationships
- part of [LevelData](LevelData.md) (and so of [Level](Level.md))
- refers to [Theme](Theme.md) and [Dimensions](Dimensions.md); `pickupRequired` is the value [PickupRequirement](PickupRequirement.md) wraps

## Members
| Member | Kind | Description |
|---|---|---|
| `name` | readonly property | `# name:`, or `null` |
| `theme` | readonly property | `# theme:` — `Theme.Sky` unless `cave` |
| `tileset` | readonly property | `# tileset:`, or `Level.DEFAULT_TILESET` |
| `width` | readonly property | Grid width in cells (the declared width if `# size:` is given) |
| `height` | readonly property | Number of grid rows |
| `declared` | readonly property | `# size: WxH` as [Dimensions](Dimensions.md), or `null` |
| `backgroundImage` | readonly property | `# background-image:` image id, or `null` |
| `pickupRequired` | readonly property | `# pickup-required:` — `'all'` (default) or a count |
| `viewport` | readonly property | `# viewport: WxH` (clamped to 4–200), or `null` for the whole world |

## Example
```ts
const { meta } = Level.parse('# name: cave1\n# theme: cave\n# viewport: 20x10\n####');
meta.name;       // 'cave1'
meta.theme;      // Theme.Cave
meta.viewport;   // { w: 20, h: 10 }
meta.tileset;    // 'Dirt_Platformer_Tiles' (the default)
```

## Design notes
Defaults are applied when parsing, so readers never test for a missing
directive — `meta.theme` is always a `Theme`. It stays a plain data
interface (not a class) because it is serialised into the golden vectors
and read by the agent package, which only knows its shape.
