# MemoryStore

`apps/editor/src/MemoryStore.ts` · class

A [KeyValueStore](KeyValueStore.md) kept in memory for the life of the page:
the fallback when the browser refuses localStorage, and the fake in tests.

## Relationships
- implements [KeyValueStore](KeyValueStore.md)
- returned by [BrowserStorage](BrowserStorage.md)`.withFallback()` in private mode

## Members
| Member | Kind | Description |
|---|---|---|
| `new MemoryStore(seed?)` | constructor | Start with the given entries |
| `getItem`, `setItem`, `removeItem` | methods | |
| `has(key)` | method | Whether `key` is present (handy in tests) |

## Example
```ts
const store = new MemoryStore({ 'v23.theme': 'light' });
new Preferences(store).theme; // EditorTheme.Light
```

## Design notes
One class serving production (a degraded mode) and tests shows why the
interface exists: anything that stores strings will do.
