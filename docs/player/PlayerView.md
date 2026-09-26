# PlayerView

`apps/player/src/PlayerView.ts` · class

The player page's elements (`index.html`), wrapped in small view objects. [PlayerApp](PlayerApp.md) talks to this instead of querying the DOM itself.

## Relationships
- owns a [LevelPicker](LevelPicker.md) (`#level`) and a [MessagePanel](MessagePanel.md) (`#message`), and the `#game` canvas
- shows [PageState](PageState.md) on `<body data-state>`
- held by [PlayerApp](PlayerApp.md); its canvas is given to [PlaySession](PlaySession.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `fromDocument(doc)` | static method | Find the elements; a missing one throws (it would be a bug in `index.html`) |
| `picker` | readonly property | The [LevelPicker](LevelPicker.md) |
| `message` | readonly property | The [MessagePanel](MessagePanel.md) |
| `canvas` | readonly property | The game canvas |
| `showState(state)` | method | Set `<body data-state>` |
| `focusGame()` | method | Focus the canvas so the arrow keys steer the player, not the `<select>` |
| `onKeyDown(handler)` | method | Listen in the capture phase, before the focused `<select>` acts on Esc / Enter / Space |

## Example
```ts
const view = PlayerView.fromDocument(document);
view.showState(PageState.Stopped);
view.picker.focus();
```

## Design notes
- **Composition of views.** One object per element, gathered here, so the
  app has a single thing to hold and tests or other pages could swap parts.
- **Static factory.** Finding elements can fail, so it is `fromDocument`,
  not the constructor.
