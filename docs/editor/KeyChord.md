# KeyChord

`apps/editor/src/KeyboardShortcuts.ts` · interface

The fields of a key event a shortcut depends on. A browser `KeyboardEvent`
satisfies it; tests pass plain objects.

## Relationships
- the input of [KeyboardShortcuts](KeyboardShortcuts.md)`.commandFor`

## Members
| Member | Kind | Description |
|---|---|---|
| `key` | property | The key's name (`'z'`, `'Enter'`, …) |
| `metaKey`, `ctrlKey`, `shiftKey` | properties | Modifier state |

## Example
```ts
KeyboardShortcuts.commandFor({ key: 'o', ctrlKey: true, metaKey: false, shiftKey: false });
```

## Design notes
Structural typing: depend on the four fields used, not on `KeyboardEvent`.
