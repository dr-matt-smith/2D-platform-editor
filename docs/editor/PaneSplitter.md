# PaneSplitter

`apps/editor/src/PaneSplitter.ts` · class

The vertical bar (`#splitter`) between the text pane and the preview.
Dragging sets `--left-pct` (the text pane's width) in pixels; double-click
resets it to `50%`.

## Relationships
- extends [Splitter](Splitter.md)
- attached by [EditorApp](EditorApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `STORAGE_KEY` | static readonly | `'ld:v12:splitter'` |
| `MIN_LEFT`, `MIN_RIGHT` | static readonly | `220` px each |
| `attach(options?)` | static method | Wire the page's `#splitter`; null if it is not there |
| `loadInitial(storage, viewportW, minLeft?, minRight?, storageKey?)` | static method | The saved width, else half the viewport; clamped |

## Example
```ts
PaneSplitter.attach({ storage: BrowserStorage.withFallback() });
PaneSplitter.loadInitial(new MemoryStore({ 'ld:v12:splitter': '700' }), 1280); // 700
```

## Design notes
A private constructor and a static `attach` factory: attaching touches the
page, and returns null (rather than a broken object) when the bar is absent.
