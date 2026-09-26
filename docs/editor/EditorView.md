# EditorView

`apps/editor/src/EditorView.ts` · class

The editor page's markup, and typed references to the elements the
components drive. `mount` writes the page once; after that every component
updates its own elements in place.

## Relationships
- created by [EditorApp](EditorApp.md), which hands its elements to the components

## Members
| Member | Kind | Description |
|---|---|---|
| `mount(root)` | static method | Write the page into `root`; returns the view |
| `source` | readonly property | The `#src` textarea |
| `gutter`, `ruler` | readonly properties | The line-number gutter and column ruler |
| `rightPane`, `toolbar`, `dirty` | readonly properties | `.pane.right`, its `.status` toolbar, the `#dirty` marker |
| `fitButton`, `themeButton` | readonly properties | `#fitBtn`, `#themeBtn` |
| `levelSelect`, `tilesetSelect` | readonly properties | `#levelSel`, `#tilesetSel` |
| `canvasWrap`, `preview`, `overlay` | readonly properties | `.canvas-wrap` and its two canvases |
| `legend`, `problems` | readonly properties | `#legend`, `#problems` |

## Example
```ts
const view = EditorView.mount(document.querySelector<HTMLElement>('#app')!);
view.preview.width; // the #preview canvas, already typed
```

## Design notes
- **One place for the markup.** The ids and classes the stylesheet and the
  end-to-end specs depend on are all in one template, so it is clear what
  must not change.
- **Typed lookups once.** Components receive elements, not selectors, so a
  missing element fails at startup rather than on first use, and no
  component queries the whole document.
- **Private constructor, static factory.** `mount` has a side effect
  (writing the page), so it is a named factory rather than a constructor.
