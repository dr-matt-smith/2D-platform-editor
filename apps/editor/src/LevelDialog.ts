import { Level } from '@2d-platform/level-format';
import { escapeHtml } from './escapeHtml.ts';
import type { LevelLibrary } from './LevelLibrary.ts';
import { ModalDialog } from './ModalDialog.ts';

// What the New level form produces: a tileset ('' for the default) and a
// size in cells.
export interface NewLevelSpec {
  id: string;
  w: number;
  h: number;
}

export interface LevelDialogOptions {
  library: LevelLibrary;
  // The open level, highlighted in the list.
  currentId: string | null;
  onSelect: (id: string) => void;
  // When given, each row gets a download button.
  onDownload?: (id: string) => void;
  // When given, the list starts with a "New level…" row.
  onNew?: (spec: NewLevelSpec) => void;
}

// The Levels dialog (the New button, Ctrl/Cmd+O). It has two views in one
// backdrop: the list of levels (pick, or download, one) and the New level
// form (tileset and size). It only reports what the user chose; the
// editor does the loading.
export class LevelDialog extends ModalDialog {
  // Width and height limits for a new level.
  static readonly SIZE_MIN = 4;
  static readonly SIZE_MAX = 200;
  static readonly PRESETS: ReadonlyArray<{ w: number; h: number }> = [
    { w: 24, h: 14 },
    { w: 40, h: 16 },
  ];

  constructor(private readonly options: LevelDialogOptions) {
    super();
  }

  // A typed size as a whole number within the limits (junk → the minimum).
  static clampSize(value: string | number): number {
    const n = Math.round(Number(value) || 0) || LevelDialog.SIZE_MIN;
    return Math.max(LevelDialog.SIZE_MIN, Math.min(LevelDialog.SIZE_MAX, n));
  }

  protected render(): void {
    this.showList();
  }

  protected dismiss(): void {
    this.close();
  }

  private showList(): void {
    const { library, currentId, onDownload, onNew, onSelect } = this.options;
    const rows = library
      .list()
      .map(
        (l) => `
        <li class="lv-row${l.id === currentId ? ' current' : ''}" data-id="${escapeHtml(l.id)}">
          <button class="lv-pick" data-id="${escapeHtml(l.id)}">
            <span class="lv-name">${escapeHtml(l.name)}</span>
            <span class="lv-id">${escapeHtml(l.id)}</span>
            ${l.modified ? '<span class="lv-mod">● modified</span>' : ''}
          </button>
          ${onDownload ? `<button class="lv-dl" data-id="${escapeHtml(l.id)}" title="Download .txt">⇩</button>` : ''}
        </li>`,
      )
      .join('');

    this.backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="Open level">
        <header>Levels<button class="lv-close" aria-label="Close">✕</button></header>
        <ul class="lv-list">
          ${onNew ? `<li class="lv-row lv-new-row"><button class="lv-new">＋ New level…</button></li>` : ''}
          ${rows}
        </ul>
      </div>`;

    this.find('.modal').addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const id = target.closest<HTMLElement>('[data-id]')?.dataset.id;
      if (target.closest('.lv-new')) return void this.showNew();
      if (target.closest('.lv-dl')) return onDownload?.(id!);
      if (target.closest('.lv-pick')) {
        this.close();
        return onSelect(id!);
      }
      if (target.closest('.lv-close')) this.close();
    });
  }

  private async showNew(): Promise<void> {
    const [preset] = LevelDialog.PRESETS;
    const { SIZE_MIN, SIZE_MAX } = LevelDialog;
    this.backdrop.innerHTML = `
      <div class="modal nv" role="dialog" aria-modal="true" aria-label="New level">
        <header>New level<button class="lv-close" aria-label="Close">✕</button></header>
        <div class="nv-form">
          <label class="nv-field">Tileset
            <select class="nv-ts"><option>loading…</option></select>
          </label>
          <div class="nv-field nv-size">
            <label>Width <input class="nv-w" type="number" min="${SIZE_MIN}" max="${SIZE_MAX}" value="${preset.w}"></label>
            <label>Height <input class="nv-h" type="number" min="${SIZE_MIN}" max="${SIZE_MAX}" value="${preset.h}"></label>
          </div>
          <div class="nv-presets">
            ${LevelDialog.PRESETS.map(
              (p) =>
                `<button class="cf-btn nv-preset" data-w="${p.w}" data-h="${p.h}">${p.w}×${p.h}</button>`,
            ).join('')}
          </div>
          <div class="cf-actions">
            <button class="cf-btn nv-back">Back</button>
            <button class="cf-btn primary nv-create">Create</button>
          </div>
        </div>
      </div>`;

    const tilesetSelect = this.find<HTMLSelectElement>('.nv-ts');
    const width = this.find<HTMLInputElement>('.nv-w');
    const height = this.find<HTMLInputElement>('.nv-h');

    // The default option ('' → no `# tileset:` line) works even offline;
    // the manifest's tilesets are added when it loads.
    const tilesets = await this.options.library.tilesets();
    tilesetSelect.innerHTML =
      `<option value="">Dirt (default)</option>` +
      tilesets
        .filter((t) => t.id !== Level.DEFAULT_TILESET)
        .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`)
        .join('');

    this.find('.modal').addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.lv-close')) return this.close();
      if (target.closest('.nv-back')) return this.showList();
      const presetButton = target.closest<HTMLElement>('.nv-preset');
      if (presetButton) {
        width.value = presetButton.dataset.w!;
        height.value = presetButton.dataset.h!;
        return;
      }
      if (target.closest('.nv-create')) {
        this.close();
        this.options.onNew!({
          id: tilesetSelect.value,
          w: LevelDialog.clampSize(width.value),
          h: LevelDialog.clampSize(height.value),
        });
      }
    });
  }
}
