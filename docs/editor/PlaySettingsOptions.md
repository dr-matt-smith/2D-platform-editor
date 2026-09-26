# PlaySettingsOptions

`apps/editor/src/PlaySettingsDialog.ts` · interface

What a [PlaySettingsDialog](PlaySettingsDialog.md) starts from and reports to.

## Relationships
- passed to [PlaySettingsDialog](PlaySettingsDialog.md) by [EditorApp](EditorApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `pickupRequired` | optional property | Current rule (default `'all'`) |
| `viewport` | optional property | Current viewport (default none) |
| `total` | optional property | The level's pickup count, shown for context |
| `onSave(value)` | optional property | Called with the [PlaySettings](PlaySettings.md) |
| `onCancel()` | optional property | Called on Cancel, Esc or an outside click |

## Example
```ts
new PlaySettingsDialog({ pickupRequired: 'all', viewport: null, total: 4, onSave }).open();
```

## Design notes
Every field optional, with defaults applied in the constructor.
