# LevelDialogOptions

`apps/editor/src/LevelDialog.ts` · interface

What a [LevelDialog](LevelDialog.md) needs.

## Relationships
- passed to [LevelDialog](LevelDialog.md) by [EditorApp](EditorApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `library` | property | The [LevelLibrary](LevelLibrary.md) to list |
| `currentId` | property | The open level, highlighted |
| `onSelect(id)` | property | A level was picked |
| `onDownload(id)` | optional property | When given, rows get a download button |
| `onNew(spec)` | optional property | When given, the list starts with "New level…" |

## Example
See [LevelDialog](LevelDialog.md).

## Design notes
Optional callbacks switch optional features on, so the dialog shows only
what the caller can handle.
