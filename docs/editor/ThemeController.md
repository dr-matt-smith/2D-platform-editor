# ThemeController

`apps/editor/src/ThemeController.ts` · class

Light or dark mode, applied as `body.lightmode` (which re-binds the
stylesheet's colour variables). Until the user picks a theme the editor
follows the OS; once they toggle it, their choice is saved.

## Relationships
- reads and saves the theme through [Preferences](Preferences.md)
- holds an [EditorTheme](EditorTheme.md)
- toggled by [EditorApp](EditorApp.md), which shows the result on the [Toolbar](Toolbar.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new ThemeController(prefs)` | constructor | The saved theme, else `osDefault()` |
| `osDefault()` | static method | Light if the OS prefers light, else dark |
| `theme` | get accessor | The current theme |
| `apply()` | method | Set or clear `body.lightmode` |
| `toggle()` | method | Switch, save and apply |

## Example
```ts
const theme = new ThemeController(prefs);
theme.apply();
theme.toggle(); // dark ⇄ light, saved as v23.theme
```

## Design notes
State plus one behaviour: the class is small because the stylesheet does
the real work.
