# PlaySettings

`apps/editor/src/PlaySettingsDialog.ts` · interface

The two settings the Play Settings dialog edits.

## Relationships
- reported by [PlaySettingsDialog](PlaySettingsDialog.md) to `onSave`; written by [EditorApp](EditorApp.md) through `LevelText`

## Members
| Member | Kind | Description |
|---|---|---|
| `pickupRequired` | property | level-format's `PickupRequired`: `'all'`, `0`, or a positive count |
| `viewport` | property | `{ w, h }` in cells, or null to show the whole level |

## Example
```ts
{ pickupRequired: 3, viewport: { w: 20, h: 12 } }
```

## Design notes
Plain data that maps one-to-one onto the `# pickup-required:` and
`# viewport:` directives.
