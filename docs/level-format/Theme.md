# Theme

`packages/level-format/src/Theme.ts` · enum

A level's visual theme, set by its `# theme:` directive.

## Relationships
- the `theme` of [LevelMeta](LevelMeta.md); also [Level](Level.md)`.theme`
- read by the renderer to choose the background and decor

## Members
| Member | Kind | Description |
|---|---|---|
| `Sky` = `'sky'` | enum member | Night sky with moon, stars and grass — the default |
| `Cave` = `'cave'` | enum member | Dark dirt background, no celestial decor |

## Example
```ts
Level.parse('# theme: cave\n###').theme === Theme.Cave;   // true
Level.parse('# theme: lava\n###').theme;                  // Theme.Sky — unknown themes fall back
```

## Design notes
A string enum whose values are the words written in level files. Parsing
maps any unrecognised word to `Theme.Sky`, so `meta.theme` is always a
valid member.
