// A modal dialog: a `.modal-backdrop` covering the page with the dialog's
// markup inside it. The base class does what every dialog shares —
// showing and removing the backdrop, and treating Esc or a click on the
// backdrop (outside the dialog) as "dismiss" — while each subclass fills
// in its content and says what dismissing means for it.
//
//   new ConfirmDialog({ … }).open();
//
// A dialog is opened once; after `close()` make a new one.
export abstract class ModalDialog {
  protected readonly backdrop: HTMLDivElement;
  // Kept as a field so the same function can be removed on close.
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.dismiss();
  };

  constructor() {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
  }

  // Build the content, start listening and show the dialog.
  open(): void {
    this.render();
    document.addEventListener('keydown', this.onKeyDown);
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.dismiss();
    });
    document.body.appendChild(this.backdrop);
    this.opened();
  }

  // Remove the dialog and stop listening.
  protected close(): void {
    document.removeEventListener('keydown', this.onKeyDown);
    this.backdrop.remove();
  }

  // Fill `backdrop` with the dialog's markup and wire its controls.
  protected abstract render(): void;

  // Esc or a click outside the dialog: cancel, in this dialog's terms.
  protected abstract dismiss(): void;

  // Runs once the dialog is on the page (e.g. to focus a field).
  protected opened(): void {}

  // The element matching `selector` inside the dialog (it must exist).
  protected find<T extends Element = HTMLElement>(selector: string): T {
    return this.backdrop.querySelector<T>(selector)!;
  }
}
