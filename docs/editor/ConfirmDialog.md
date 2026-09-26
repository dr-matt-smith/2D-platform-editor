# ConfirmDialog

`apps/editor/src/ConfirmDialog.ts` · generic class

A message and a row of buttons; reports the value of the one chosen.
Dismissing (Esc, or a click outside) chooses the last action, which callers
make Cancel. The editor uses it for "unsaved changes".

## Relationships
- extends [ModalDialog](ModalDialog.md)
- configured by [ConfirmOptions](ConfirmOptions.md) of [ConfirmAction](ConfirmAction.md)s
- opened by [EditorApp](EditorApp.md)`.guardUnsaved`

## Members
| Member | Kind | Description |
|---|---|---|
| `new ConfirmDialog<T>(options)` | constructor | |
| `render()` | protected method | The message and buttons |
| `dismiss()` | protected method | Choose the last action |

## Example
```ts
new ConfirmDialog<'save' | 'discard' | 'cancel'>({
  message: '“tutorial” has unsaved changes.',
  actions: [
    { label: 'Save draft & continue', value: 'save', primary: true },
    { label: 'Discard & continue', value: 'discard' },
    { label: 'Cancel', value: 'cancel' },
  ],
  onChoice: (choice) => { /* … */ },
}).open();
```

## Design notes
**Generics.** The type parameter `T` ties the action values to the
`onChoice` argument, so a caller's `switch` over the choice is type-checked.
