# SoundBank

`packages/engine/src/SoundBank.ts` · class

The game's sound effects, synthesised with Web Audio (no audio files): each
sound is a few oscillator notes with a gain envelope.

## Relationships
- implements [SoundPlayer](SoundPlayer.md)
- plays [Sound](Sound.md)s made of [SynthNote](SynthNote.md)s, with [PlayOptions](PlayOptions.md)
- owned by [Game](Game.md); created and pre-warmed by [Playtest](Playtest.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `notesOf(sound)` | static method | The notes that make up a sound |
| `ready` | get accessor | Has the AudioContext been created? |
| `prewarm()` | method | Create and resume the AudioContext now (call from a user gesture) |
| `play(sound, options?)` | method | Play a sound; creates the AudioContext on first use. Does nothing without Web Audio |

## Example
```ts
const sounds = new SoundBank();
sounds.prewarm();                          // inside the Play click handler
sounds.play(Sound.Coin, { volume: 0.4 });  // on a pickup
```

## Design notes
- **Lazy resource.** Browsers only allow audio after a user gesture, so the
  AudioContext is created on first need — or earlier by `prewarm()`, which
  the launcher calls in the Play click so the first pickup sound isn't
  ~50 ms late.
- **Data as a static table.** The recipes are a private static map keyed by
  the [Sound](Sound.md) enum, so adding a sound is one table entry.
- **Fails quietly.** Without Web Audio (Deno, old browsers) every method
  does nothing, so the game never breaks for want of sound.
- Adapted from simple-platformer-1's `AssetLoader` (CC BY 4.0); its unused
  sprite and level loaders were dropped.
