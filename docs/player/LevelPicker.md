# LevelPicker

`apps/player/src/LevelPicker.ts` · class

The level `<select>` (`#level`): filled from the catalog's groups, with an `<optgroup>` for each named group.

## Relationships
- owned by [PlayerView](PlayerView.md)
- filled with [LevelGroup](LevelGroup.md)s from [LevelCatalog](LevelCatalog.md)`.groups()`

## Members
| Member | Kind | Description |
|---|---|---|
| `new LevelPicker(select)` | constructor | The element to manage |
| `value` | get / set accessor | The selected level id |
| `fill(groups)` | method | Replace the options; disabled when there are no levels |
| `onChange(handler)` | method | Call `handler(id)` when the player picks a level |
| `focus()` | method | Focus the `<select>` |

## Example
```ts
picker.fill(catalog.groups());
picker.value = 'tutorial';
picker.onChange((id) => url.remember(id));
```

## Design notes
- **Accessors.** `value` reads like a field but goes through the element,
  so the DOM stays the single source of truth for the selection.
- **Intention-revealing API.** Callers say `fill(groups)`; building
  `<option>` and `<optgroup>` elements is hidden inside.
