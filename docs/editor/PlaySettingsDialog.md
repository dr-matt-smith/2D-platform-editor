# PlaySettingsDialog

`apps/editor/src/PlaySettingsDialog.ts` · class

The Play Settings dialog: the Play camera (fit the whole level, or a
scrolling window of W×H cells) and the pickup rule (all, at least N, or
none). Save reports both; the editor writes them as one undo step.
Focusing a number field selects its radio button.

## Relationships
- extends [ModalDialog](ModalDialog.md)
- configured by [PlaySettingsOptions](PlaySettingsOptions.md); reports [PlaySettings](PlaySettings.md)
- opened by [EditorApp](EditorApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `DEFAULT_VIEWPORT` | static readonly | `{ w: 20, h: 12 }`, offered when the level has none |
| `new PlaySettingsDialog(options)` | constructor | |
| `initialPickup(pickupRequired, total)` | static method | Which pickup radio starts checked, and the starting N |
| `readPickup(mode, n)` | static method | The pickup rule for a radio value and typed N |
| `readViewport(mode, w, h)` | static method | The viewport for a radio value and typed size (null for fit) |
| `render()` | protected method | The form |
| `dismiss()` | protected method | Close and call `onCancel` |

## Example
```ts
PlaySettingsDialog.readPickup('min', '3');  // 3
PlaySettingsDialog.readViewport('fit', '30', '10'); // null
```

## Design notes
The form's rules — defaults, flooring, falling back on junk — are static
methods from strings to values, tested without a page; the DOM code only
reads the fields and calls them.
