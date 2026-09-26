# GlyphLookup

`packages/level-format/src/GlyphLookup.ts` · interface

The part of a tileset's `tile_lookup.json` that describes its glyphs — the
input to `Legend.fromLookup`.

## Relationships
- holds [GlyphDef](GlyphDef.md)s, keyed by a descriptive name
- read by [Legend](Legend.md)`.fromLookup`
- extended by the render package's `TileLookup`, which adds the image and animation fields

## Members
| Member | Kind | Description |
|---|---|---|
| `glyphs` | optional property | `Record<key, GlyphDef \| null \| undefined>` — `player`, `filled`, `apple`, … |

## Example
```ts
const lookup: GlyphLookup = {
  glyphs: { player: { char: 'P', name: 'Player', role: 'entity' } },
};
Legend.fromLookup(lookup).roleOf('P');   // Role.Player
```

## Design notes
It describes *unvalidated JSON*, so every field is optional and may be
`null`; turning it into something reliable is the legend's job. Only the
fields this package reads are declared — other packages extend the
interface with theirs.
