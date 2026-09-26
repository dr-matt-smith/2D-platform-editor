# PastedLevel

`apps/editor/src/PasteLoadDialog.ts` · interface

What the user pasted into the Load dialog, and the name to list it under.

## Relationships
- passed by [PasteLoadDialog](PasteLoadDialog.md) to `onLoad`

## Members
| Member | Kind | Description |
|---|---|---|
| `text` | property | The pasted level text |
| `name` | property | The typed name, else the `# name:` line, else `'untitled'` |

## Example
```ts
{ text: '#####\n#P.E#\n#####', name: 'untitled' }
```

## Design notes
Plain data from the view to the editor.
