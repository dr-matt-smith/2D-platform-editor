# LocalLevelEntry

`apps/editor/src/LibraryEntries.ts` · interface

One pasted ("local") level, as stored in the `ld:v24:locals` JSON list. Its
text is stored under its draft key, like any draft.

## Relationships
- written and read by [LevelLibrary](LevelLibrary.md) (`addLocal`, `list`)

## Members
| Member | Kind | Description |
|---|---|---|
| `id` | property | `local-` plus 8 random characters |
| `name` | property | Display name |

## Example
```json
[{ "id": "local-k3j9x0qa", "name": "my level" }]
```

## Design notes
Kept minimal so the stored format never needs migrating.
