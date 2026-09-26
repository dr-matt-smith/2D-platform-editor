import { escapeHtml } from './escapeHtml.ts';
import type { LevelLibrary } from './LevelLibrary.ts';

// The toolbar's Level menu (`#levelSel`): every level in the library,
// with ● before those that have a saved draft. Choosing one reports its
// id; the editor guards unsaved changes before switching.
export class LevelMenu {
  constructor(
    private readonly select: HTMLSelectElement,
    private readonly library: LevelLibrary,
    onChoose: (id: string) => void,
  ) {
    select.addEventListener('change', () => onChoose(select.value));
  }

  populate(): void {
    this.select.innerHTML = this.library
      .list()
      .map((l) => `<option value="${escapeHtml(l.id)}">${l.modified ? '● ' : ''}${escapeHtml(l.name)}</option>`)
      .join('');
  }

  // Rebuild (so ● markers are current) and select `id`. An unsaved new
  // level (null) shows as "(untitled)"; an id not in the library as
  // "<id> (missing)".
  sync(id: string | null): void {
    this.populate();
    if (id == null) {
      if (![...this.select.options].some((o) => o.value === '')) {
        this.select.insertAdjacentHTML('beforeend', `<option value="">(untitled)</option>`);
      }
      this.select.value = '';
      return;
    }
    if (![...this.select.options].some((o) => o.value === id)) {
      this.select.insertAdjacentHTML(
        'beforeend',
        `<option value="${escapeHtml(id)}">${escapeHtml(id)} (missing)</option>`,
      );
    }
    if (this.select.value !== id) this.select.value = id;
  }
}
