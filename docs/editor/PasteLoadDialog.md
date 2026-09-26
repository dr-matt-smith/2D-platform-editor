# PasteLoadDialog

`apps/editor/src/PasteLoadDialog.ts` · class

The Load dialog: paste a level's text, optionally name it, and Load. The
name defaults to the text's `# name:` line, then to "untitled". If loading
fails the error is shown and the dialog stays open.

## Relationships
- extends [ModalDialog](ModalDialog.md)
- configured by [PasteLoadOptions](PasteLoadOptions.md); reports a [PastedLevel](PastedLevel.md)
- opened by [EditorApp](EditorApp.md), which stores the level with [LevelLibrary](LevelLibrary.md)`.addLocal`

## Members
| Member | Kind | Description |
|---|---|---|
| `new PasteLoadDialog(options)` | constructor | |
| `problemWith(text)` | static method | Why pasted text cannot be loaded, or null. Only unreadable text or text with no grid is refused |
| `nameIn(text)` | static method | The `# name:` value, or null |
| `render()` | protected method | The form |
| `dismiss()` | protected method | Close and call `onCancel` |
| `opened()` | protected method | Focus the text area |

## Example
```ts
PasteLoadDialog.problemWith('# name: nothing'); // 'No level grid found in the pasted text.'
```

## Design notes
Overrides the optional `opened` hook to move focus once the dialog is on
the page. The acceptance rule is a static method so it is unit-tested.
