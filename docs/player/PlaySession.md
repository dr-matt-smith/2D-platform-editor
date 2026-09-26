# PlaySession

`apps/player/src/PlaySession.ts` · class

Turns level text into a running game on one canvas. The engine's launcher allows a single playtest at a time, so the session owns the current run and always exits it before starting another.

## Relationships
- launches the engine's `Playtest`; parses with level-format's `Level`
- holds a [TilesetCache](TilesetCache.md)
- returns a `StartResult` tagged with a [StartStatus](StartStatus.md)
- held by [PlayerApp](PlayerApp.md); draws on [PlayerView](PlayerView.md)`.canvas`

## Members
| Member | Kind | Description |
|---|---|---|
| `new PlaySession(canvas, tilesets?)` | constructor | The canvas to play on; a fresh [TilesetCache](TilesetCache.md) by default |
| `playing` | get accessor | True while a game is running |
| `start(loadText)` | async method | Stop any run, load and parse the level, load its tileset, launch. `Invalid` carries the launch-gate reasons; `Cancelled` if overtaken |
| `stop()` | method | Exit the current run and cancel any `start` still loading |
| `generation` | private property | Bumped by every `start` and `stop`, so a stale `start` knows not to launch |

## Example
```ts
const result = await session.start(() => catalog.loadText(level));
if (result.status === StartStatus.Invalid) panel.showList('Can\'t play', result.reasons.map(MessagePanel.describeIssue));
```

## Design notes
- **Encapsulation.** The run and the generation counter are private; callers
  only see `start`, `stop` and `playing`, and cannot get the session into a
  state with two games running.
- **Results, not exceptions, for expected outcomes.** An invalid or
  cancelled start is a normal result; only a genuine bug throws.
