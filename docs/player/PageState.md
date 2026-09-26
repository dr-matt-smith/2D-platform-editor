# PageState

`apps/player/src/PageState.ts` · enum

What the player page is doing. The value is mirrored on `<body data-state>`, so the stylesheet and the e2e specs can see it.

## Relationships
- owned by [PlayerApp](PlayerApp.md); shown by [PlayerView](PlayerView.md)`.showState()`

## Members
| Member | Kind | Description |
|---|---|---|
| `Loading` = `'loading'` | enum member | Fetching the level and its tileset |
| `Playing` = `'playing'` | enum member | The game owns the canvas and the keyboard |
| `Stopped` = `'stopped'` | enum member | Esc was pressed; the picker has focus |
| `Invalid` = `'invalid'` | enum member | The level failed the engine's launch gate |
| `Error` = `'error'` | enum member | Something could not be fetched |

## Example
```ts
if (event.key === 'Escape' && this.state === PageState.Playing) this.stopPlaying();
```

## Design notes
A string enum whose values are the `data-state` strings the CSS selects on (`body[data-state='playing']`), so the page is unchanged.
