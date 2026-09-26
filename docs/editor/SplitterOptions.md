# SplitterOptions

`apps/editor/src/Splitter.ts` · interface

Where a splitter lives. Every field defaults to the real page.

## Relationships
- passed to [PaneSplitter](PaneSplitter.md)`.attach` and [ProblemsSplitter](ProblemsSplitter.md)`.attach`

## Members
| Member | Kind | Description |
|---|---|---|
| `doc` | optional property | The document (default `document`) |
| `win` | optional property | The window (default `window`) |
| `storage` | optional property | A [KeyValueStore](KeyValueStore.md) (default `BrowserStorage.withFallback()`) |

## Example
```ts
PaneSplitter.attach({ doc: fakeDocument, win: fakeWindow, storage: new MemoryStore() });
```

## Design notes
Optional injection: production passes nothing, tests pass fakes.
