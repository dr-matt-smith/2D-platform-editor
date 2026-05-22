// Modal level picker. Pure UI: it knows nothing about storage or parsing —
// it renders rows from levels.list() and emits intent callbacks.

// W/H bounds for a new level (shared with the clamp on Create).
const SIZE_MIN = 4;
const SIZE_MAX = 200;
const PRESETS = [
  { w: 24, h: 14 },
  { w: 40, h: 16 },
];
const clampSize = (v) =>
  Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(Number(v) || 0) || SIZE_MIN));

/**
 * Open the level loader modal.
 * @param levels    the createLevels() api (uses list(), tilesets())
 * @param currentId id of the level currently in the buffer (highlighted)
 * @param onSelect  (id) => void               — user picked a level
 * @param onDownload(id) => void               — optional; per-row download
 * @param onNew     ({ id, w, h }) => void      — optional; create a blank level
 */
export function openLevelDialog({ levels, currentId, onSelect, onDownload, onNew }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  function close() {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);
  // Click outside the modal cancels (the backdrop element persists across
  // the list⇄new view swaps, so this one listener covers both).
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  // --- List view -------------------------------------------------------
  function showList() {
    const rows = levels
      .list()
      .map(
        (l) => `
        <li class="lv-row${l.id === currentId ? ' current' : ''}" data-id="${l.id}">
          <button class="lv-pick" data-id="${l.id}">
            <span class="lv-name">${l.name}</span>
            <span class="lv-id">${l.id}</span>
            ${l.modified ? '<span class="lv-mod">● modified</span>' : ''}
          </button>
          ${onDownload ? `<button class="lv-dl" data-id="${l.id}" title="Download .txt">⇩</button>` : ''}
        </li>`,
      )
      .join('');

    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="Open level">
        <header>Levels<button class="lv-close" aria-label="Close">✕</button></header>
        <ul class="lv-list">
          ${onNew ? `<li class="lv-row lv-new-row"><button class="lv-new">＋ New level…</button></li>` : ''}
          ${rows}
        </ul>
      </div>`;

    backdrop.querySelector('.modal').addEventListener('click', (e) => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      if (e.target.closest('.lv-new')) return showNew();
      if (e.target.closest('.lv-dl')) return onDownload?.(id);
      if (e.target.closest('.lv-pick')) {
        close();
        return onSelect(id);
      }
      if (e.target.closest('.lv-close')) close();
    });
  }

  // --- New-level view --------------------------------------------------
  async function showNew() {
    backdrop.innerHTML = `
      <div class="modal nv" role="dialog" aria-modal="true" aria-label="New level">
        <header>New level<button class="lv-close" aria-label="Close">✕</button></header>
        <div class="nv-form">
          <label class="nv-field">Tileset
            <select class="nv-ts"><option>loading…</option></select>
          </label>
          <div class="nv-field nv-size">
            <label>Width <input class="nv-w" type="number" min="${SIZE_MIN}" max="${SIZE_MAX}" value="${PRESETS[0].w}"></label>
            <label>Height <input class="nv-h" type="number" min="${SIZE_MIN}" max="${SIZE_MAX}" value="${PRESETS[0].h}"></label>
          </div>
          <div class="nv-presets">
            ${PRESETS.map(
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

    const sel = backdrop.querySelector('.nv-ts');
    const wEl = backdrop.querySelector('.nv-w');
    const hEl = backdrop.querySelector('.nv-h');

    // The default option ('' → main.js omits the directive) always works,
    // even offline; manifest entries are appended when available.
    const ts = await levels.tilesets();
    sel.innerHTML =
      `<option value="">Dirt (default)</option>` +
      ts
        .filter((t) => t.id !== 'Dirt_Platformer_Tiles')
        .map((t) => `<option value="${t.id}">${t.name}</option>`)
        .join('');

    backdrop.querySelector('.modal').addEventListener('click', (e) => {
      if (e.target.closest('.lv-close')) return close();
      if (e.target.closest('.nv-back')) return showList();
      const preset = e.target.closest('.nv-preset');
      if (preset) {
        wEl.value = preset.dataset.w;
        hEl.value = preset.dataset.h;
        return;
      }
      if (e.target.closest('.nv-create')) {
        close();
        onNew({ id: sel.value, w: clampSize(wEl.value), h: clampSize(hEl.value) });
      }
    });
  }

  showList();
  document.body.appendChild(backdrop);
}

/**
 * Small confirm modal.
 * @param message  prompt text
 * @param actions  [{ label, value, primary? }] — rendered left→right
 * @param onChoice (value) => void; Esc/backdrop resolves the last action
 *                 (treated as Cancel by callers)
 */
export function openConfirm({ message, actions, onChoice }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal confirm" role="dialog" aria-modal="true">
      <p class="cf-msg">${message}</p>
      <div class="cf-actions">
        ${actions
          .map(
            (a, i) =>
              `<button class="cf-btn${a.primary ? ' primary' : ''}" data-i="${i}">${a.label}</button>`,
          )
          .join('')}
      </div>
    </div>`;

  function close() {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
  }
  function choose(value) {
    close();
    onChoice(value);
  }
  const cancelValue = actions[actions.length - 1].value;
  function onKey(e) {
    if (e.key === 'Escape') choose(cancelValue);
  }

  backdrop.addEventListener('click', (e) => {
    const btn = e.target.closest('.cf-btn');
    if (btn) choose(actions[Number(btn.dataset.i)].value);
    else if (e.target === backdrop) choose(cancelValue);
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);
}

/**
 * v18+ — Play Settings popup.
 *
 * v18 shipped one row: pickup requirement.
 * v19 adds a second row: viewport (camera in play mode).
 *
 * @param pickupRequired 'all' | 0 | positive integer (default 'all')
 * @param viewport       null (default = fit / no scrolling) | { w, h }
 * @param total          the level's current pickup count (informational)
 * @param onSave         (value) => void where value =
 *                       { pickupRequired, viewport }
 * @param onCancel       () => void
 */
export function openPlaySettings({
  pickupRequired = 'all',
  viewport = null,
  total = 0,
  onSave,
  onCancel,
}) {
  // Pickup row: map the input value to one of the three radio choices
  // + the numeric input.
  const initialMode =
    pickupRequired === 'all' ? 'all' : pickupRequired === 0 ? 'none' : 'min';
  const initialN =
    typeof pickupRequired === 'number' && pickupRequired > 0
      ? pickupRequired
      : Math.max(1, Math.min(total, 1));

  // v19 viewport row: null → fit (radio "Fit"); { w, h } → window
  // (radio "Window" + the two number inputs). When fit is selected we
  // still pre-fill the inputs with a sensible default so flipping the
  // radio without typing produces a usable viewport.
  const initialVpMode = viewport ? 'window' : 'fit';
  const initialVw = viewport?.w ?? 20;
  const initialVh = viewport?.h ?? 12;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal confirm play-settings" role="dialog" aria-modal="true" aria-label="Play settings">
      <header class="play-settings-header">Play Settings</header>
      <p class="cf-msg"><strong>Viewport</strong> — camera in play mode.</p>
      <div class="ps-rows">
        <label class="ps-row">
          <input type="radio" name="ps-viewport" value="fit" ${initialVpMode === 'fit' ? 'checked' : ''}>
          <span>Fit whole level (default) — no scrolling</span>
        </label>
        <label class="ps-row">
          <input type="radio" name="ps-viewport" value="window" ${initialVpMode === 'window' ? 'checked' : ''}>
          <span>Window:</span>
          <input type="number" id="ps-vw" min="4" max="200" value="${initialVw}">
          <span>×</span>
          <input type="number" id="ps-vh" min="4" max="200" value="${initialVh}">
          <span>cells</span>
        </label>
      </div>
      <hr class="popup-divider">
      <p class="cf-msg"><strong>Pickup requirement</strong> — what does the player need to collect before the exit ends the level?</p>
      <div class="ps-rows">
        <label class="ps-row">
          <input type="radio" name="ps-pickups" value="all" ${initialMode === 'all' ? 'checked' : ''}>
          <span>All pickups required (default)</span>
        </label>
        <label class="ps-row">
          <input type="radio" name="ps-pickups" value="min" ${initialMode === 'min' ? 'checked' : ''}>
          <span>At least</span>
          <input type="number" id="ps-n" min="1" max="${Math.max(1, total)}" value="${initialN}">
          <span>pickups</span>
        </label>
        <label class="ps-row">
          <input type="radio" name="ps-pickups" value="none" ${initialMode === 'none' ? 'checked' : ''}>
          <span>No minimum — touching the exit wins</span>
        </label>
      </div>
      <p class="cf-msg" style="opacity:0.7"><small>This level has ${total} pickup${total === 1 ? '' : 's'}.</small></p>
      <div class="cf-actions">
        <button class="cf-btn" data-act="cancel">Cancel</button>
        <button class="cf-btn primary" data-act="save">Save</button>
      </div>
    </div>`;

  function close() {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
  }
  function readValue() {
    // Pickup ----------------------------------------------------------
    const pickupMode =
      backdrop.querySelector('input[name="ps-pickups"]:checked')?.value || 'all';
    let pickupRequiredOut;
    if (pickupMode === 'all') pickupRequiredOut = 'all';
    else if (pickupMode === 'none') pickupRequiredOut = 0;
    else {
      const n = Number(backdrop.querySelector('#ps-n').value);
      pickupRequiredOut = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
    }
    // Viewport --------------------------------------------------------
    const vpMode =
      backdrop.querySelector('input[name="ps-viewport"]:checked')?.value || 'fit';
    let viewportOut = null;
    if (vpMode === 'window') {
      const w = Number(backdrop.querySelector('#ps-vw').value);
      const h = Number(backdrop.querySelector('#ps-vh').value);
      // Defer the [4, 200] clamp to setViewportDirective so the dialog
      // doesn't duplicate the rule; just floor sensible numbers here.
      viewportOut = {
        w: Number.isFinite(w) && w > 0 ? Math.floor(w) : 20,
        h: Number.isFinite(h) && h > 0 ? Math.floor(h) : 12,
      };
    }
    return { pickupRequired: pickupRequiredOut, viewport: viewportOut };
  }
  function save() { close(); onSave?.(readValue()); }
  function cancel() { close(); onCancel?.(); }
  function onKey(e) { if (e.key === 'Escape') cancel(); }

  backdrop.addEventListener('click', (e) => {
    const btn = e.target.closest('.cf-btn');
    if (btn) {
      if (btn.dataset.act === 'save') save();
      else cancel();
    } else if (e.target === backdrop) cancel();
  });
  // Selecting the "At least N" radio focuses the number input for
  // immediate keyboard entry; typing into the input also auto-selects
  // that radio so the user doesn't need a second click.
  backdrop.querySelector('#ps-n').addEventListener('focus', () => {
    backdrop.querySelector('input[name="ps-pickups"][value="min"]').checked = true;
  });
  // Same affordance for the viewport W/H inputs: focusing either flips
  // the "Window" radio so typing a value implicitly selects the row.
  for (const id of ['#ps-vw', '#ps-vh']) {
    backdrop.querySelector(id).addEventListener('focus', () => {
      backdrop.querySelector('input[name="ps-viewport"][value="window"]').checked = true;
    });
  }
  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);
}
