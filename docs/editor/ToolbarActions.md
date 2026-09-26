# ToolbarActions

`apps/editor/src/Toolbar.ts` · interface

What each toolbar button does. The [EditorApp](EditorApp.md) supplies them.

## Relationships
- passed to [Toolbar](Toolbar.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `download()` | method | Download (`#dlBtn`) |
| `play()` | method | Play (`#playBtn`) |
| `playSettings()` | method | Play Settings (`#playSettingsBtn`) |
| `test()` | method | Test (`#testBtn`) |
| `toggleFit()` | method | ⛶ Fit (`#fitBtn`) |
| `toggleTheme()` | method | 🌗 (`#themeBtn`) |
| `newLevel()` | method | New (`#newBtn`) |
| `load()` | method | Load (`#loadBtn`) |
| `restart()` | method | Restart (`#restartBtn`, Play only) |
| `exit()` | method | Exit (`#exitBtn`, Play only) |

## Example
See [EditorApp](EditorApp.md)'s constructor.

## Design notes
One method per button makes the toolbar's whole vocabulary visible in one
place, and the compiler checks the editor supplies every action.
