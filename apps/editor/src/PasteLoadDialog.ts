import { Level } from '@2d-platform/level-format';
import { ModalDialog } from './ModalDialog.ts';

// What the user pasted, and the name to list it under.
export interface PastedLevel {
  text: string;
  name: string;
}

export interface PasteLoadOptions {
  // Returns null if the level was loaded, or an error message to show
  // (the dialog then stays open).
  onLoad?: (pasted: PastedLevel) => string | null;
  onCancel?: () => void;
}

// The Load dialog: paste a level's text, optionally name it, and Load.
// The name defaults to the text's `# name:` line, then to "untitled".
export class PasteLoadDialog extends ModalDialog {
  constructor(private readonly options: PasteLoadOptions) {
    super();
  }

  // Why `text` cannot be loaded, or null if it can. Only an unreadable
  // text or one with no grid is refused; validation problems (no exit, …)
  // are allowed, since the user may be importing a draft to fix here.
  static problemWith(text: string): string | null {
    let level: Level;
    try {
      level = Level.parse(text);
    } catch (e) {
      return `Could not parse the pasted text: ${(e as Error | null)?.message || e}`;
    }
    if (!level?.grid?.length || level.meta.width <= 0) {
      return 'No level grid found in the pasted text.';
    }
    return null;
  }

  // The value of a `# name:` line in `text`, or null.
  static nameIn(text: string): string | null {
    const m = String(text || '').match(/^#\s*name\s*:\s*(\S.*?)\s*$/m);
    return m ? m[1].trim() : null;
  }

  protected render(): void {
    this.backdrop.innerHTML = `
    <div class="modal confirm paste-load-dialog" role="dialog" aria-modal="true" aria-label="Load level">
      <header class="play-settings-header">Load Level</header>
      <p class="cf-msg">Paste a level definition below:</p>
      <textarea id="pl-text" class="pl-text" spellcheck="false" autocomplete="off" rows="14" placeholder="# name: my-level&#10;##########&#10;#P......E#&#10;##########"></textarea>
      <hr class="popup-divider">
      <label class="pl-name-row">
        <span>Display name:</span>
        <input type="text" id="pl-name" placeholder="untitled" maxlength="60">
      </label>
      <p class="cf-msg pl-error" hidden></p>
      <div class="cf-actions">
        <button class="cf-btn" data-act="cancel">Cancel</button>
        <button class="cf-btn primary" data-act="load">Load</button>
      </div>
    </div>`;
    this.find('[data-act="cancel"]').addEventListener('click', () => this.dismiss());
    this.find('[data-act="load"]').addEventListener('click', () => this.load());
  }

  protected dismiss(): void {
    this.close();
    this.options.onCancel?.();
  }

  // Focus the text area, the thing to paste into.
  protected override opened(): void {
    setTimeout(() => this.find<HTMLTextAreaElement>('#pl-text').focus(), 0);
  }

  private load(): void {
    this.showError(null);
    const text = this.find<HTMLTextAreaElement>('#pl-text').value;
    const typedName = this.find<HTMLInputElement>('#pl-name').value.trim();
    const name = typedName || PasteLoadDialog.nameIn(text) || 'untitled';
    const error = this.options.onLoad?.({ text, name });
    if (error) {
      this.showError(error);
      return; // keep the dialog open
    }
    this.close();
  }

  // Show `message` under the form, or hide the error line when null.
  private showError(message: string | null): void {
    const el = this.find('.pl-error');
    el.textContent = message ?? '';
    el.hidden = message === null;
  }
}
