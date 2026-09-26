# SoundPlayer

`packages/engine/src/SoundPlayer.ts` · interface

Something that can play the game's sound effects.

## Relationships
- implemented by [SoundBank](SoundBank.md); the headless [JsPhysicsAdapter](JsPhysicsAdapter.md) passes a silent object
- plays a [Sound](Sound.md) with [PlayOptions](PlayOptions.md)
- part of [SceneHost](SceneHost.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `play(sound, options?)` | method | Play a sound |

## Example
```ts
const silent: SoundPlayer = { play() {} };
```

## Design notes
The scene depends on this one-method interface, not on Web Audio, so it can
run thousands of silent simulations for the agent — no cast or fake class
needed.
