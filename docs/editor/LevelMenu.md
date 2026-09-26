# LevelMenu

`apps/editor/src/LevelMenu.ts` · class

The toolbar's Level menu (`#levelSel`): every level in the library, with ●
before those with a saved draft. Choosing one reports its id; the editor
guards unsaved changes before switching, and on Cancel calls `sync` to put
the menu back.

## Relationships
- lists [LevelLibrary](LevelLibrary.md)`.list()` ([LevelListItem](LevelListItem.md)s)
- reports to [EditorApp](EditorApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new LevelMenu(select, library, onChoose)` | constructor | |
| `populate()` | method | Rebuild the options |
| `sync(id)` | method | Rebuild and select `id`; `null` shows "(untitled)", an unknown id "(missing)" |

## Example
```ts
levelMenu.sync(currentId); // after opening a level or cancelling a switch
```

## Design notes
Rebuilding on every sync keeps the ● markers current without the menu
having to watch the library.
