# ModalDialog

`apps/editor/src/ModalDialog.ts` · abstract class

A modal dialog: a `.modal-backdrop` over the page with the dialog inside.
The base class does what every dialog shares — adding and removing the
backdrop, and treating Esc or a click on the backdrop as "dismiss" — and
each subclass supplies its content and what dismissing means for it.

## Relationships
- extended by [LevelDialog](LevelDialog.md), [ConfirmDialog](ConfirmDialog.md),
  [PlaySettingsDialog](PlaySettingsDialog.md), [PasteLoadDialog](PasteLoadDialog.md)
  and [AgentDialog](AgentDialog.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new ModalDialog()` | constructor | Create the (detached) backdrop |
| `backdrop` | protected readonly property | The `.modal-backdrop` element the content goes in |
| `open()` | method | `render`, start listening, add to the page, then `opened` |
| `close()` | protected method | Stop listening and remove the backdrop |
| `render()` | protected abstract method | Fill `backdrop` and wire its controls |
| `dismiss()` | protected abstract method | Esc or outside click: this dialog's "cancel" |
| `opened()` | protected method | Hook run once on the page (does nothing by default) |
| `find(selector)` | protected method | An element inside the dialog |

## Example
```ts
class HelloDialog extends ModalDialog {
  protected render(): void {
    this.backdrop.innerHTML = '<div class="modal"><button class="cf-btn">OK</button></div>';
    this.find('.cf-btn').addEventListener('click', () => this.close());
  }
  protected dismiss(): void {
    this.close();
  }
}
new HelloDialog().open();
```

## Design notes
- **Template method.** `open` is written once and calls the hooks in a fixed
  order; subclasses fill in the steps. Required hooks are `abstract`, so a
  dialog that forgets to handle dismissal does not compile; the optional
  one has an empty default.
- **Protected members** are the subclass API: outside code can only
  `open()` a dialog.
- **The keydown handler is a field** (an arrow function), so the very same
  function can be removed on close and `this` is always the dialog.
- **One use per object.** A dialog is opened once; after closing, make a
  new one. That keeps each dialog's state simple.
