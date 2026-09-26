# LegendLayout

`apps/editor/src/LegendLayout.ts` · enum

Where the legend panel sits.

## Relationships
- saved by [Preferences](Preferences.md)`.legendLayout`; used by [LegendPanel](LegendPanel.md)

## Members
| Member | Value | Meaning |
|---|---|---|
| `Right` | `'right'` | Beside the preview (default) — pane class `layout-right` |
| `Bottom` | `'bottom'` | Below the preview — pane class `layout-bottom` |

## Example
```ts
prefs.legendLayout = LegendLayout.Bottom; // stored as 'bottom'
```

## Design notes
The values are the stored strings, so saved layouts carry over.
