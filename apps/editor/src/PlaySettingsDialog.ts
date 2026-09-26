import type { Dimensions, PickupRequired } from '@2d-platform/level-format';
import { ModalDialog } from './ModalDialog.ts';

// The settings the dialog edits: the level's `# pickup-required:` and
// `# viewport:` directives.
export interface PlaySettings {
  pickupRequired: PickupRequired;
  // null: show the whole level (no scrolling).
  viewport: Dimensions | null;
}

export interface PlaySettingsOptions {
  pickupRequired?: PickupRequired;
  viewport?: Dimensions | null;
  // The level's pickup count, shown for context.
  total?: number;
  onSave?: (value: PlaySettings) => void;
  onCancel?: () => void;
}

// The Play Settings dialog: the Play camera (fit the whole level, or a
// scrolling window of W×H cells) and the pickup rule (all, at least N, or
// none). Save reports both; the editor writes them as one undo step.
//
// Turning form values into settings is pure, in static methods, so it is
// unit-tested without a page.
export class PlaySettingsDialog extends ModalDialog {
  // The viewport offered when the level has none.
  static readonly DEFAULT_VIEWPORT: Dimensions = { w: 20, h: 12 };

  private readonly pickupRequired: PickupRequired;
  private readonly viewport: Dimensions | null;
  private readonly total: number;

  constructor(private readonly options: PlaySettingsOptions) {
    super();
    this.pickupRequired = options.pickupRequired ?? 'all';
    this.viewport = options.viewport ?? null;
    this.total = options.total ?? 0;
  }

  // Which pickup radio starts checked ('all' | 'min' | 'none'), and the
  // starting N for "at least N".
  static initialPickup(pickupRequired: PickupRequired, total: number): { mode: string; n: number } {
    const mode = pickupRequired === 'all' ? 'all' : pickupRequired === 0 ? 'none' : 'min';
    const n = typeof pickupRequired === 'number' && pickupRequired > 0
      ? pickupRequired
      : Math.max(1, Math.min(total, 1));
    return { mode, n };
  }

  // The pickup rule for a radio `mode` and the typed N.
  static readPickup(mode: string, n: string): PickupRequired {
    if (mode === 'all') return 'all';
    if (mode === 'none') return 0;
    const value = Number(n);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  }

  // The viewport for a radio `mode` and the typed W and H. The [4, 200]
  // clamp is left to LevelText, which owns that rule.
  static readViewport(mode: string, w: string, h: string): Dimensions | null {
    if (mode !== 'window') return null;
    const width = Number(w);
    const height = Number(h);
    const fallback = PlaySettingsDialog.DEFAULT_VIEWPORT;
    return {
      w: Number.isFinite(width) && width > 0 ? Math.floor(width) : fallback.w,
      h: Number.isFinite(height) && height > 0 ? Math.floor(height) : fallback.h,
    };
  }

  protected render(): void {
    const { total } = this;
    const pickup = PlaySettingsDialog.initialPickup(this.pickupRequired, total);
    const vpMode = this.viewport ? 'window' : 'fit';
    const vw = this.viewport?.w ?? PlaySettingsDialog.DEFAULT_VIEWPORT.w;
    const vh = this.viewport?.h ?? PlaySettingsDialog.DEFAULT_VIEWPORT.h;
    this.backdrop.innerHTML = `
    <div class="modal confirm play-settings" role="dialog" aria-modal="true" aria-label="Play settings">
      <header class="play-settings-header">Play Settings</header>
      <p class="cf-msg"><strong>Viewport</strong> — camera in play mode.</p>
      <div class="ps-rows">
        <label class="ps-row">
          <input type="radio" name="ps-viewport" value="fit" ${vpMode === 'fit' ? 'checked' : ''}>
          <span>Fit whole level (default) — no scrolling</span>
        </label>
        <label class="ps-row">
          <input type="radio" name="ps-viewport" value="window" ${vpMode === 'window' ? 'checked' : ''}>
          <span>Window:</span>
          <input type="number" id="ps-vw" min="4" max="200" value="${vw}">
          <span>×</span>
          <input type="number" id="ps-vh" min="4" max="200" value="${vh}">
          <span>cells</span>
        </label>
      </div>
      <hr class="popup-divider">
      <p class="cf-msg"><strong>Pickup requirement</strong> — what does the player need to collect before the exit ends the level?</p>
      <div class="ps-rows">
        <label class="ps-row">
          <input type="radio" name="ps-pickups" value="all" ${pickup.mode === 'all' ? 'checked' : ''}>
          <span>All pickups required (default)</span>
        </label>
        <label class="ps-row">
          <input type="radio" name="ps-pickups" value="min" ${pickup.mode === 'min' ? 'checked' : ''}>
          <span>At least</span>
          <input type="number" id="ps-n" min="1" max="${Math.max(1, total)}" value="${pickup.n}">
          <span>pickups</span>
        </label>
        <label class="ps-row">
          <input type="radio" name="ps-pickups" value="none" ${pickup.mode === 'none' ? 'checked' : ''}>
          <span>No minimum — touching the exit wins</span>
        </label>
      </div>
      <p class="cf-msg" style="opacity:0.7"><small>This level has ${total} pickup${total === 1 ? '' : 's'}.</small></p>
      <div class="cf-actions">
        <button class="cf-btn" data-act="cancel">Cancel</button>
        <button class="cf-btn primary" data-act="save">Save</button>
      </div>
    </div>`;

    this.backdrop.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('.cf-btn');
      if (!button) return;
      if (button.dataset.act === 'save') this.save();
      else this.dismiss();
    });
    // Focusing a number field selects its radio, so typing a value is
    // enough to choose that row.
    this.selectRadioOnFocus('#ps-n', 'input[name="ps-pickups"][value="min"]');
    for (const id of ['#ps-vw', '#ps-vh']) {
      this.selectRadioOnFocus(id, 'input[name="ps-viewport"][value="window"]');
    }
  }

  protected dismiss(): void {
    this.close();
    this.options.onCancel?.();
  }

  private save(): void {
    this.close();
    this.options.onSave?.(this.readValue());
  }

  private readValue(): PlaySettings {
    const checked = (name: string, fallback: string) =>
      this.backdrop.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value || fallback;
    const value = (id: string) => this.find<HTMLInputElement>(id).value;
    return {
      pickupRequired: PlaySettingsDialog.readPickup(checked('ps-pickups', 'all'), value('#ps-n')),
      viewport: PlaySettingsDialog.readViewport(checked('ps-viewport', 'fit'), value('#ps-vw'), value('#ps-vh')),
    };
  }

  private selectRadioOnFocus(input: string, radio: string): void {
    this.find(input).addEventListener('focus', () => {
      this.find<HTMLInputElement>(radio).checked = true;
    });
  }
}
