# KeyValueStore

`apps/editor/src/KeyValueStore.ts` · interface

A string key-value store: the part of the browser's `Storage` (localStorage)
the editor uses.

## Relationships
- implemented by [BrowserStorage](BrowserStorage.md) and [MemoryStore](MemoryStore.md) (and by `localStorage` itself)
- used by [LevelLibrary](LevelLibrary.md) (through [LevelLibraryIO](LevelLibraryIO.md)),
  [Preferences](Preferences.md) and the [Splitter](Splitter.md)s

## Members
| Member | Kind | Description |
|---|---|---|
| `getItem(key)` | method | The value, or null |
| `setItem(key, value)` | method | |
| `removeItem(key)` | method | |

## Example
```ts
function remember(store: KeyValueStore, id: string) {
  store.setItem('ld:v3:lastOpen', id);
}
remember(new MemoryStore(), 'tutorial');
```

## Design notes
The contract half of dependency injection. Its method names match
`Storage`, so the real thing fits without an adapter.
