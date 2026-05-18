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
