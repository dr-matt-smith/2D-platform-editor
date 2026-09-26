# SynthNote

`packages/engine/src/SoundBank.ts` · interface

One oscillator note of a synthesised sound (times in seconds, relative to
the sound's start).

## Relationships
- a [Sound](Sound.md)'s recipe in [SoundBank](SoundBank.md) is a list of these

## Members
| Member | Kind | Description |
|---|---|---|
| `freq` | property | Frequency in Hz |
| `start` | property | Start time |
| `dur` | property | Duration |
| `type` | property | Oscillator waveform (`'square'`, …) |
| `peak` | property | Peak loudness before volume and headroom |

## Example
```ts
SoundBank.notesOf(Sound.Coin)[0]; // { freq: 880, start: 0, dur: 0.09, type: 'square', peak: 1 }
```

## Design notes
Plain data: a sound is described, and [SoundBank](SoundBank.md) is the one
place that knows how to turn a description into Web Audio calls.
