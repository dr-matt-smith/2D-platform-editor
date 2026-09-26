# LevelListItem

`apps/editor/src/LibraryEntries.ts` · interface

One row of [LevelLibrary](LevelLibrary.md)`.list()`: a bundled level or a
local one.

## Relationships
- listed by [LevelMenu](LevelMenu.md) and [LevelDialog](LevelDialog.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `id`, `name` | properties | |
| `file` | property | The bundled file, or null for a local level |
| `group` | optional property | `'local'` for local levels |
| `modified` | property | A saved draft exists (always false for local levels) |

## Example
```ts
library.list().filter((l) => l.modified); // levels with drafts
```

## Design notes
One shape for both kinds of level, so the menus need not tell them apart.
