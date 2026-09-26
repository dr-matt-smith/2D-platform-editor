# PasteLoadOptions

`apps/editor/src/PasteLoadDialog.ts` · interface

What a [PasteLoadDialog](PasteLoadDialog.md) reports to.

## Relationships
- passed to [PasteLoadDialog](PasteLoadDialog.md) by [EditorApp](EditorApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `onLoad(pasted)` | optional property | Returns null if loaded, or an error message to show |
| `onCancel()` | optional property | Called on Cancel, Esc or an outside click |

## Example
```ts
new PasteLoadDialog({
  onLoad: ({ text, name }) => PasteLoadDialog.problemWith(text) ?? (openLocal(text, name), null),
}).open();
```

## Design notes
Returning the error (rather than throwing) lets the dialog decide how to
show it and stay open.
