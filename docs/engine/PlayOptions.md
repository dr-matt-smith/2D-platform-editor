# PlayOptions

`packages/engine/src/SoundPlayer.ts` · interface

Options for one playback of a [Sound](Sound.md).

## Relationships
- passed to [SoundPlayer](SoundPlayer.md)`.play` / [SoundBank](SoundBank.md)`.play`

## Members
| Member | Kind | Description |
|---|---|---|
| `volume?` | property | Loudness multiplier, default `1` |

## Example
```ts
sounds.play(Sound.Coin, { volume: 0.4 });
```

## Design notes
An options object leaves room for more settings without changing every
call.
