# KeyboardShortcuts

`apps/editor/src/KeyboardShortcuts.ts` · class

The editor's Ctrl/Cmd shortcuts: O (Levels dialog), Enter (Play), Z (undo),
Shift+Z or Y (redo). Deciding what a key press means is a pure static
method; `attach` listens on the document.

## Relationships
- maps a [KeyChord](KeyChord.md) to a [Shortcut](Shortcut.md)
- attached by [EditorApp](EditorApp.md), which runs the commands

## Members
| Member | Kind | Description |
|---|---|---|
| `commandFor(e)` | static method | The [Shortcut](Shortcut.md) for a key event, or null |
| `attach(doc, handler)` | static method | Call `handler` for each shortcut, suppressing the browser's own action |

## Example
```ts
KeyboardShortcuts.commandFor({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: true }); // Shortcut.Redo
```

## Design notes
A class of static methods, because there is no state. Separating
`commandFor` from `attach` makes the key map testable without a keyboard.
The native textarea undo is suppressed so it cannot diverge from the
editor's [UndoHistory](UndoHistory.md).
