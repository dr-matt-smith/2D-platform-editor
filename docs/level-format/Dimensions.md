# Dimensions

`packages/level-format/src/LevelData.ts` · interface

A size in grid cells, `{ w, h }`.

## Relationships
- used by [LevelMeta](LevelMeta.md) (`declared`, `viewport`)
- taken by [LevelText](LevelText.md)`.setViewport`

## Members
| Member | Kind | Description |
|---|---|---|
| `w` | readonly property | Width in cells |
| `h` | readonly property | Height in cells |

## Example
```ts
new LevelText(text).setViewport({ w: 24, h: 14 });
```

## Design notes
A plain data shape rather than a class: sizes are written into saved data
and passed to other packages, and need no behaviour of their own.
