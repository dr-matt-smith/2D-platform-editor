import { escapeHtml } from './escapeHtml.ts';
import { ModalDialog } from './ModalDialog.ts';

// One button of a ConfirmDialog, and the value it chooses.
export interface ConfirmAction<T> {
  label: string;
  value: T;
  primary?: boolean;
}

export interface ConfirmOptions<T> {
  message: string;
  // Buttons, left to right. The last is the "cancel" choice.
  actions: ConfirmAction<T>[];
  onChoice: (value: T) => void;
}

// A message and a row of buttons; reports the value of the one chosen.
// Dismissing (Esc, or a click outside) chooses the last action, which
// callers treat as Cancel.
export class ConfirmDialog<T> extends ModalDialog {
  constructor(private readonly options: ConfirmOptions<T>) {
    super();
  }

  protected render(): void {
    const { message, actions } = this.options;
    this.backdrop.innerHTML = `
    <div class="modal confirm" role="dialog" aria-modal="true">
      <p class="cf-msg">${escapeHtml(message)}</p>
      <div class="cf-actions">
        ${actions
          .map(
            (a, i) =>
              `<button class="cf-btn${a.primary ? ' primary' : ''}" data-i="${i}">${escapeHtml(a.label)}</button>`,
          )
          .join('')}
      </div>
    </div>`;
    this.backdrop.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('.cf-btn');
      if (button) this.choose(actions[Number(button.dataset.i)].value);
    });
  }

  protected dismiss(): void {
    const { actions } = this.options;
    this.choose(actions[actions.length - 1].value);
  }

  private choose(value: T): void {
    this.close();
    this.options.onChoice(value);
  }
}
