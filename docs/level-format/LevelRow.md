# LevelRow

`packages/level-format/src/LevelData.ts` · interface

One grid row exactly as written, before padding, with the line of the file
it came from — so an issue can point at the right line even when directives
and `//` comments come first.

## Relationships
- part of [LevelData](LevelData.md)`.rows`
- used by [LevelValidator](LevelValidator.md) for line numbers and the declared-width check, and by the editor to write painted rows back into the text

## Members
| Member | Kind | Description |
|---|---|---|
| `text` | readonly property | The row's characters, unpadded |
| `line` | readonly property | 1-based line number in the original text |

## Example
```ts
Level.parse('// note\n# size: 3x1\n###').rows;   // [{ text: '###', line: 3 }]
```

## Design notes
A tiny data interface: keeping the original line with each row is what lets
the validator report positions in the author's text and the editor edit the
grid without disturbing the header.
