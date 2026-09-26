# Toolbar

`apps/editor/src/Toolbar.ts` · class

The toolbar above the preview (`.pane.right > .status`): its buttons, the
Fit and theme buttons' states, and the "● unsaved" marker. Edit buttons
carry `.edit-only` and Play's Restart / Exit carry `.play-only`; the
stylesheet shows one set or the other from the body's mode class.

## Relationships
- calls a [ToolbarActions](ToolbarActions.md) (implemented by [EditorApp](EditorApp.md))
- pinned and unpinned by [PlayModeController](PlayModeController.md) and [AgentController](AgentController.md)
- shows an [EditorTheme](EditorTheme.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new Toolbar(element, dirty, fitButton, themeButton, actions)` | constructor | Bind each button to its action |
| `showDirty(dirty)` | method | Show or clear "● unsaved" |
| `showFit(on)` | method | The Fit button's `active` class and title |
| `showTheme(theme)` | method | The theme button's title |
| `pinHeight()` / `unpinHeight()` | methods | Hold the toolbar at its current height while Play or Test swaps the buttons |

## Example
```ts
toolbar.pinHeight();          // before entering Play
document.body.classList.add('playmode');
```

## Design notes
- **View, not controller.** The toolbar reports clicks and shows state it is
  given; it never decides what a button does.
- **Why pin the height.** At high zoom the edit buttons wrap onto two rows;
  Play shows only two buttons, so without the pin the toolbar would shrink
  and the canvas jump up.
