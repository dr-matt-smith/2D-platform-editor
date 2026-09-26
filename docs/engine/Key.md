# Key

`packages/engine/src/Key.ts` · enum

The keys the game reads, by their normalised name.

## Relationships
- produced by [KeyboardInput](KeyboardInput.md) from `KeyboardEvent.key`
- stored in [RecordingEvent](RecordingEvent.md)s and read by every [InputSource](InputSource.md)
- read by [Player](Player.md) (movement) and [PlaytestScene](PlaytestScene.md) (restart)

## Members
| Member | Value | Meaning |
|---|---|---|
| `Left` | `'left'` | Run left (←) |
| `Right` | `'right'` | Run right (→) |
| `Up` | `'up'` | Jump (↑) |
| `Down` | `'down'` | ↓ (unused by the game, but normalised) |
| `Space` | `'space'` | Jump |
| `R` | `'r'` | Restart |

The type alias `KeyName` is `Key` or any other lower-case character: the
type every [InputSource](InputSource.md) method takes.

## Example
```ts
if (input.isDown(Key.Right)) vx = SPEED;
```

## Design notes
A string enum whose values are the strings in saved agent recordings
(`{ key: 'right' }`), so recordings made before the enum existed still
replay.
