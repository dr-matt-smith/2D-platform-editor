# Sound

`packages/engine/src/Sound.ts` · enum

The sound effects the game can play, by name.

## Relationships
- played through a [SoundPlayer](SoundPlayer.md) such as [SoundBank](SoundBank.md)
- played by [PlaytestScene](PlaytestScene.md)

## Members
| Member | Value | Meaning |
|---|---|---|
| `Coin` | `'coin'` | Pickup collected: a short rising two-note arpeggio |

## Example
```ts
this.game.sounds.play(Sound.Coin, { volume: 0.4 });
```

## Design notes
An enum instead of free strings: a misspelt sound name is a compile error,
and [SoundBank](SoundBank.md)'s recipe table is typed to have an entry for
every member.
