# LevelUrl

`apps/player/src/LevelUrl.ts` · class

The `?level=<id>` part of the page address: which level a shared link asks for, and keeping it current so the level being played can be shared.

## Relationships
- held by [PlayerApp](PlayerApp.md); built by `main.ts` from `location` and `history`

## Members
| Member | Kind | Description |
|---|---|---|
| `new LevelUrl(location, history)` | constructor | Only `href` / `search` and `replaceState` are used |
| `requested()` | method | The `level` parameter, or `null` |
| `remember(id)` | method | Set `level` with `history.replaceState` (no new history entry), keeping the rest of the address |

## Example
```ts
const url = new LevelUrl(location, history);
url.requested();        // 'tutorial' for /apps/player/?level=tutorial
url.remember('simple'); // address becomes ?level=simple
```

## Design notes
- **Depend on the least you need.** The constructor takes
  `Pick<Location, 'href' | 'search'>` and `Pick<History, 'replaceState'>`,
  so a test passes two tiny objects instead of a browser.
