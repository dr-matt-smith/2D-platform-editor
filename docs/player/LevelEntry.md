# LevelEntry

`apps/player/src/LevelEntry.ts` · interface

One level from `content/data/levels/manifest.json`.

## Relationships
- held by [LevelCatalog](LevelCatalog.md); grouped in [LevelGroup](LevelGroup.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `id` | property | Used in `?level=` and as the option value |
| `name` | property | Shown in the picker; defaults to the id |
| `file` | property | The file under `data/levels/` |
| `group` | optional property | Picker heading, if any |

## Example
```ts
catalog.find('tutorial');   // { id: 'tutorial', name: 'tutorial', file: 'tutorial.txt' }
```

## Design notes
Plain data from the manifest; an interface because it has no behaviour.
