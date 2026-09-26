import { Level } from '@2d-platform/level-format';
import { escapeHtml } from './escapeHtml.ts';
import type { LevelLibrary } from './LevelLibrary.ts';

// The toolbar's Tileset menu (`#tilesetSel`), listing the tilesets
// manifest. Choosing one reports its id; the editor then rewrites the
// level's `# tileset:` line.
export class TilesetMenu {
  // Offered when the tilesets manifest is missing (offline).
  private static readonly FALLBACK = [{ id: Level.DEFAULT_TILESET, name: 'Dirt Platformer Tiles' }];

  constructor(
    private readonly select: HTMLSelectElement,
    private readonly library: LevelLibrary,
    onChoose: (id: string) => void,
  ) {
    select.addEventListener('change', () => onChoose(select.value));
  }

  async populate(): Promise<void> {
    const list = await this.library.tilesets();
    const items = list.length ? list : TilesetMenu.FALLBACK;
    this.select.innerHTML = items
      .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`)
      .join('');
  }

  // Select `id`. A tileset not in the manifest is added as
  // "<id> (missing)", so the menu always shows the truth.
  sync(id: string): void {
    if (![...this.select.options].some((o) => o.value === id)) {
      this.select.insertAdjacentHTML(
        'beforeend',
        `<option value="${escapeHtml(id)}">${escapeHtml(id)} (missing)</option>`,
      );
    }
    if (this.select.value !== id) this.select.value = id;
  }
}
