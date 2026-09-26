# EntityState

`packages/render/src/EntityState.ts` · interface

Game state that can change which sprite a glyph shows. The playtest passes
it while playing; the editor preview never does, so authors always see the
normal sprites.

## Relationships
- taken by [Tileset](Tileset.md)`.entityFor` / [RenderTileset](RenderTileset.md)`.entityFor`
- carried in [DrawOptions](DrawOptions.md)`.entityState`
- set by the engine's `PlaytestScene` from the level's pickup rule

## Members
| Member | Kind | Description |
|---|---|---|
| `exitLocked` | optional property | `true` while the pickup rule is not yet met: the exit `E` then shows its `imageLocked` sprite, if the tileset has one |

## Example
```ts
tileset.entityFor('E', now, { exitLocked: true });   // the locked exit sprite
```

## Design notes
An interface of optional flags, so a new kind of state can be added without
changing any caller that does not use it.
