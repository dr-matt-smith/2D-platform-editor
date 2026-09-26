# BrowserStorage

`apps/editor/src/BrowserStorage.ts` · class

The browser's localStorage as a [KeyValueStore](KeyValueStore.md). Each call
reaches `localStorage` afresh, so a browser that refuses storage throws from
the call, not from construction.

## Relationships
- implements [KeyValueStore](KeyValueStore.md)
- `withFallback` returns it, or a [MemoryStore](MemoryStore.md)
- created by [EditorApp](EditorApp.md) (and by the splitters when no store is given)

## Members
| Member | Kind | Description |
|---|---|---|
| `getItem`, `setItem`, `removeItem` | methods | Delegate to `localStorage` |
| `withFallback()` | static method | localStorage if a test write succeeds, else a `MemoryStore` |

## Example
```ts
const drafts = BrowserStorage.withFallback();   // survives private mode
const prefs = new Preferences(new BrowserStorage()); // Preferences catches failures itself
```

## Design notes
**Adapter** over a browser global, so the rest of the code depends only on
the interface. The static factory makes the private-mode decision once.
