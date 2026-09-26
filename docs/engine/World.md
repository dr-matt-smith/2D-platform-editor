# World

`packages/engine/src/World.ts` · class

The game world a level becomes: one [Entity](Entity.md) per meaningful cell,
kept in a list per kind. Built from a parsed level by a static factory.

## Relationships
- built from level-format's `LevelData` and `Legend` by `fromLevel`
- owns [Player](Player.md), [Platform](Platform.md)s, [Coin](Coin.md)s, [Spike](Spike.md)s and [Goal](Goal.md)s
- `size` is a [Size](Size.md); `entities` is a list of [Entity](Entity.md)
- used by [PlaytestScene](PlaytestScene.md) (rebuilt on every restart) and [Playtest](Playtest.md) (to size the canvas)

## Members
| Member | Kind | Description |
|---|---|---|
| `fromLevel(level, legend?, tile?)` | static method | Build the world. `legend` defaults to `Legend.DEFAULT`, `tile` to the engine's `TILE` (20) |
| `player` | readonly property | The [Player](Player.md), or `null` if the level has no player cell |
| `platforms`, `coins`, `spikes`, `goals` | readonly properties | One array per kind |
| `width`, `height` | readonly properties | The whole level's size in pixels |
| `size` | get accessor | `{ w: width, h: height }` |
| `entities` | get accessor | Every entity, back to front, the player last |
| `draw(ctx)` | method | Ask every entity to draw itself |

Each cell is mapped by its glyph's **role** in the legend:

| Role | Becomes |
|---|---|
| `terrain` | `Platform` (kind `Ground`) |
| `player` | `Player` (if several, the last wins) |
| `hazard` | `Spike` |
| `pickup` | `Coin` |
| `exit` | `Goal` |
| anything else | nothing |

## Example
```ts
import { Level } from '@2d-platform/level-format';
import { World } from '@2d-platform/engine';

const world = World.fromLevel(Level.parse('#####\n#Po.E#\n#####'));
world.coins.length; // 1
world.size;         // { w: 100, h: 60 }
```

## Design notes
- **Static factory, private constructor.** Building a world means reading a
  whole level; the constructor only stores the finished lists
  (`Level.parse` in level-format works the same way). Building never fails:
  unknown glyphs are skipped.
- **Roles, not characters.** A tileset that rebinds the player to `@`, or
  has three kinds of pickup, needs no engine change.
- **Lists per kind *and* one polymorphic list.** The scene's rules treat each
  kind differently (collect coins, die on spikes, win on goals — in that
  order), so it keeps typed lists. Code that treats all entities alike uses
  `entities`, as `draw` does.
- **Why the arrays aren't `readonly`.** The agent's contract types the
  scene's `coins` as a plain (mutable) array, so the world's arrays are
  plain too; the *properties* are still `readonly`.
