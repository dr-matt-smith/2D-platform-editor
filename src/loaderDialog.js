// Modal level picker. Pure UI: it knows nothing about storage or parsing —
// it renders rows from levels.list() and emits intent callbacks.

/**
 * Open the level loader modal.
 * @param levels    the createLevels() api (uses list())
 * @param currentId id of the level currently in the buffer (highlighted)
 * @param onSelect  (id) => void   — user picked a level
 * @param onDownload(id) => void   — optional; per-row download
 */
export function openLevelDialog({ levels, currentId, onSelect, onDownload }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

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
      <ul class="lv-list">${rows}</ul>
    </div>`;

  function close() {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  backdrop.addEventListener('click', (e) => {
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (e.target.closest('.lv-dl')) {
      onDownload?.(id);
      return;
    }
    if (e.target.closest('.lv-pick')) {
      close();
      onSelect(id);
      return;
    }
    // backdrop / close button → cancel (no state change)
    if (e.target === backdrop || e.target.closest('.lv-close')) close();
  });
  document.addEventListener('keydown', onKey);

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
