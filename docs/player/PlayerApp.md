# PlayerApp

`apps/player/src/PlayerApp.ts` · class

The player app: pick a level from the bundled manifest and play it full-window. It owns the page state and moves between states in response to the level picker, the keyboard and the play session.

## Relationships
- built by `main.ts`
- holds a [PlayerView](PlayerView.md), a [PlaySession](PlaySession.md), a [LevelUrl](LevelUrl.md) and (once loaded) a [LevelCatalog](LevelCatalog.md)
- moves between [PageState](PageState.md)s; reads [StartStatus](StartStatus.md) from the session

## Members
| Member | Kind | Description |
|---|---|---|
| `new PlayerApp(view, session, url, loadCatalog)` | constructor | The collaborators; `loadCatalog` fetches the level list |
| `start()` | async method | Wire the picker and keys, load the catalog, select `?level` (or the first level) and play it |
| `state` | private property | The current [PageState](PageState.md) |
| `handleKey(event)` | private method | Esc stops while playing or loading; Enter / Space plays once stopped |
| `playSelectedLevel()` | private async method | Loading → Playing, Invalid (with reasons) or Error |
| `stopPlaying()` | private method | Stop the session, show "Paused", focus the picker |

## Example
```ts
const view = PlayerView.fromDocument(document);
const app = new PlayerApp(
  view,
  new PlaySession(view.canvas),
  new LevelUrl(location, history),
  () => LevelCatalog.load(fetch, import.meta.env.BASE_URL),
);
void app.start();
```

## Design notes
- **Composition.** The app *has* a view, a session, a URL and a catalog; it
  inherits nothing. Each collaborator does one job, and the app's methods
  read as the steps of the user's story.
- **A small state machine.** Every transition goes through `setState`, so
  the page state and `<body data-state>` can never disagree, and the key
  handler's rules are written in terms of [PageState](PageState.md).
- **Injected, not global.** The catalog loader is a function argument, so
  `main.ts` chooses the real fetch and base URL.
