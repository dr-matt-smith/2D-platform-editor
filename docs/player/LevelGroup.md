# LevelGroup

`apps/player/src/LevelGroup.ts` · interface

A run of consecutive levels sharing a group (`null` = ungrouped).

## Relationships
- made by [LevelCatalog](LevelCatalog.md)`.groups()`; shown by [LevelPicker](LevelPicker.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `group` | property | The heading, or `null` |
| `levels` | property | The [LevelEntry](LevelEntry.md)s, in manifest order |

## Example
```ts
catalog.groups();   // [{ group: 'Easy', levels: [a, b] }, { group: null, levels: [d] }]
```

## Design notes
Plain data: the shape the picker needs, computed once by the catalog.
