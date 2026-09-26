# ProblemsSplitter

`apps/editor/src/ProblemsSplitter.ts` · class

The horizontal bar (`#splitterH`) above the message bar. Dragging up grows
the bar, setting `--problems-h` in pixels. With nothing saved, the property
stays unset and the stylesheet's default height applies; double-click
removes it again.

## Relationships
- extends [Splitter](Splitter.md)
- attached by [EditorApp](EditorApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `STORAGE_KEY` | static readonly | `'ld:v13:problemsH'` |
| `MIN_PROBLEMS`, `MIN_EDITOR` | static readonly | `60`, `240` px |
| `BAR_PX` | static readonly | `6`, the bar's own height |
| `attach(options?)` | static method | Wire the page's `#splitterH`; null if it is not there |

## Example
```ts
ProblemsSplitter.attach({ storage });
```

## Design notes
Compare with [PaneSplitter](PaneSplitter.md): the same base, but `restore`
and `resetSize` leave the property *unset* rather than setting a default —
exactly the kind of difference the template method's hooks are for.
