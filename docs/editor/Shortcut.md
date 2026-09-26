# Shortcut

`apps/editor/src/Shortcut.ts` · enum

The commands bound to Ctrl/Cmd shortcuts.

## Relationships
- produced by [KeyboardShortcuts](KeyboardShortcuts.md)`.commandFor`; run by [EditorApp](EditorApp.md)

## Members
| Member | Value | Keys |
|---|---|---|
| `OpenLevels` | `'open-levels'` | Ctrl/Cmd+O |
| `Play` | `'play'` | Ctrl/Cmd+Enter |
| `Undo` | `'undo'` | Ctrl/Cmd+Z |
| `Redo` | `'redo'` | Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y |

## Example
```ts
switch (KeyboardShortcuts.commandFor(e)) {
  case Shortcut.Undo: /* … */
}
```

## Design notes
Naming the commands separates *which key* from *what happens*, and a
`switch` over an enum is checked for exhaustiveness.
