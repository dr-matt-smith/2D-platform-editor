# LevelText

`packages/level-format/src/LevelText.ts` · class

The raw text of a level exactly as the author typed it, with methods that
set or remove a single header directive and leave every other line alone.
The editor uses it for menu and dialog changes so they never reformat the
buffer (which `Level.serialize()` would).

## Relationships
- `parse()` creates a [Level](Level.md)
- uses [Level](Level.md) (`DEFAULT_TILESET`, `clampViewport`, `isComment`)
- uses [PickupRequirement](PickupRequirement.md) to decide what `# pickup-required:` to write
- takes a [Dimensions](Dimensions.md) in `setViewport`

## Members
| Member | Kind | Description |
|---|---|---|
| `new LevelText(text)` | constructor | Wrap a string |
| `text` | readonly property | The text |
| `setTileset(id, defaultId?)` | method | Set `# tileset:`; the default tileset removes the line |
| `setBackgroundImage(id)` | method | Set `# background-image:`; `null` / `''` removes it |
| `setViewport(size)` | method | Set `# viewport: WxH` (clamped); `null` / `'fit'` removes it |
| `setPickupRequired(value)` | method | Set `# pickup-required:`; `'all'`, `null` or an invalid count removes it |
| `parse()` | method | `Level.parse(this.text)` |
| `toString()` | method | The text |

A new directive line goes at the end of the header: after the leading run of
directives and `//` comments, before the first grid row. An existing line is
replaced where it is.

## Example
```ts
import { LevelText } from '@2d-platform/level-format';

const edited = new LevelText('# name: demo\n#####\n#P.E#')
  .setTileset('Treasure Hunters')
  .setViewport({ w: 20, h: 10 });

edited.toString();
// '# name: demo\n# tileset: Treasure Hunters\n# viewport: 20x10\n#####\n#P.E#'
```

## Design notes
- **Immutable value object.** Each setter returns a *new* `LevelText`, so
  calls chain naturally and the original is never changed — the same style
  as JavaScript's own strings.
- **One private method does the work.** All four setters build the line they
  want (or `null` to remove it) and hand it to the private `withDirective`.
  Adding a new directive setter is a two-line method.
- **Why not just edit a `Level`?** A `Level` is the *meaning* of the text;
  writing it back loses comments and directive order. Keeping the text as
  its own class makes that difference visible.
- `setTileset` keeps its original header test, which does not recognise
  hyphenated keys, so a new `# tileset:` line lands before e.g.
  `# background-image:`. It is kept so the editor's edits are byte-for-byte
  what they were before the restructure.
