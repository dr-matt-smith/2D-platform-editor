// Movable pane splitter (TDD v12). The visible 6px bar in main.js's
// `#splitter` is drag-handled here; pointer events drive a CSS custom
// property `--left-pct` on the document root, which the .pane.left
// width rule reads. Pure helpers (clampPx, loadInitial) are exported
// for `node --test` so the maths is exercised without a DOM.

const STORAGE_KEY = 'ld:v12:splitter';        // v12 horizontal panes
export const V13_STORAGE_KEY = 'ld:v13:problemsH'; // v13 vertical panel
const MIN_LEFT = 220;
const MIN_RIGHT = 220;
const MIN_PROBLEMS = 60;
const MIN_EDITOR = 240;

/**
 * Clamp a desired left-pane pixel width so neither pane drops below
 * its `min`. When the viewport itself can't fit both mins, prefer
 * keeping at least `minLeft` on the left (the textarea is the
 * primary editing surface).
 */
export function clampPx(px, minLeft = MIN_LEFT, minRight = MIN_RIGHT, viewportW = 0) {
  const safeViewport = Math.max(0, Number(viewportW) || 0);
  const ceiling = safeViewport - minRight;
  if (ceiling < minLeft) return minLeft; // viewport too narrow for both mins
  const v = Number(px);
  if (!Number.isFinite(v)) return minLeft;
  return Math.max(minLeft, Math.min(ceiling, Math.round(v)));
}

/**
 * Initial pane width on startup. Reads `STORAGE_KEY` from the
 * injected `storage`; falls back to half the viewport. Always
 * returns a clamped integer.
 */
export function loadInitial(
  storage,
  viewportW,
  minLeft = MIN_LEFT,
  minRight = MIN_RIGHT,
  storageKey = STORAGE_KEY,
) {
  let raw = null;
  try {
    raw = storage?.getItem?.(storageKey);
  } catch {
    /* private mode etc. → null */
  }
  const parsed = raw != null ? Number(raw) : NaN;
  const seed = Number.isFinite(parsed) ? parsed : Math.round((Number(viewportW) || 0) / 2);
  return clampPx(seed, minLeft, minRight, viewportW);
}

// localStorage shim — same defensive pattern as src/levels.js. Returns
// a Map-backed in-memory store when the real one throws (private mode,
// disabled storage). The splitter then works for the session without
// persisting.
function safeStorage(real = globalThis.localStorage) {
  try {
    const probe = '__ld_v12_probe__';
    real.setItem(probe, '1');
    real.removeItem(probe);
    return real;
  } catch {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  }
}

/**
 * Wire pointer drag + double-click reset onto the existing
 * `#splitter` element. Idempotent-ish: don't call twice in the same
 * document or you'll stack listeners. Returns the storage object in
 * use so tests can introspect (or no-op when DOM is absent).
 */
export function setupSplitter({ doc = document, win = window, storage } = {}) {
  const root = doc?.documentElement;
  const bar = doc?.querySelector('#splitter');
  if (!root || !bar) return null; // headless / not in page

  const store = storage ?? safeStorage(win?.localStorage);

  const setLeft = (px) => {
    root.style.setProperty('--left-pct', `${px}px`);
  };

  setLeft(loadInitial(store, win.innerWidth, MIN_LEFT, MIN_RIGHT));

  let dragging = false;
  let pointerId = null;

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = true;
    pointerId = e.pointerId;
    bar.classList.add('dragging');
    try { bar.setPointerCapture(pointerId); } catch { /* ok */ }
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    setLeft(clampPx(e.clientX, MIN_LEFT, MIN_RIGHT, win.innerWidth));
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    bar.classList.remove('dragging');
    try { bar.releasePointerCapture(pointerId); } catch { /* ok */ }
    pointerId = null;
    // Persist the current pixel width — read from the actual computed
    // left-pane width so we never write a clamp-stale value.
    const pane = doc.querySelector('.pane.left');
    if (pane) {
      const w = Math.round(pane.getBoundingClientRect().width);
      try { store.setItem(STORAGE_KEY, String(w)); } catch { /* ok */ }
    }
    e?.preventDefault?.();
  }

  function onDblClick() {
    // Reset: clear storage, fall back to 50% (string, not px — so a
    // window resize after this keeps it half rather than freezing the
    // moment-of-reset width).
    try { store.removeItem(STORAGE_KEY); } catch { /* ok */ }
    root.style.setProperty('--left-pct', '50%');
  }

  bar.addEventListener('pointerdown', onPointerDown);
  bar.addEventListener('pointermove', onPointerMove);
  bar.addEventListener('pointerup', onPointerUp);
  bar.addEventListener('pointercancel', onPointerUp);
  bar.addEventListener('dblclick', onDblClick);

  return store;
}

/**
 * v13: sibling splitter for the problems panel — vertical drag axis.
 * Mirrors `setupSplitter` but reads `e.clientY` and writes a
 * `--problems-h` pixel value on the document root. Default state is
 * **unset** — the CSS fallback (`height: 25vh`) applies for a fresh
 * user, identical to the v0–v12 layout. Reset clears storage AND
 * removes the property so a later window resize still keeps the
 * 25 % ratio rather than freezing the moment-of-reset pixel value.
 */
export function setupProblemsSplitter({ doc = document, win = window, storage } = {}) {
  const root = doc?.documentElement;
  const bar = doc?.querySelector('#splitterH');
  if (!root || !bar) return null;

  const store = storage ?? safeStorage(win?.localStorage);

  const setH = (px) => root.style.setProperty('--problems-h', `${px}px`);

  // Initial apply: if storage has a number, use it; otherwise leave
  // --problems-h unset so the CSS 25vh fallback applies. This keeps a
  // first-visit user's layout byte-identical to before v13.
  let initialRaw = null;
  try { initialRaw = store.getItem(V13_STORAGE_KEY); } catch { /* ok */ }
  const initialPx = initialRaw != null ? Number(initialRaw) : NaN;
  if (Number.isFinite(initialPx)) {
    setH(clampPx(initialPx, MIN_PROBLEMS, MIN_EDITOR, win.innerHeight));
  }

  let dragging = false;
  let pointerId = null;

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = true;
    pointerId = e.pointerId;
    bar.classList.add('dragging');
    try { bar.setPointerCapture(pointerId); } catch { /* ok */ }
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    // Problems-panel height grows as the user drags UPWARD — i.e. as
    // clientY decreases. The desired height is the distance from the
    // pointer to the bottom of the viewport (minus a half-bar nudge
    // is unnecessary; the clamp tolerates small offsets).
    const h = clampPx(win.innerHeight - e.clientY, MIN_PROBLEMS, MIN_EDITOR, win.innerHeight);
    setH(h);
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    bar.classList.remove('dragging');
    try { bar.releasePointerCapture(pointerId); } catch { /* ok */ }
    pointerId = null;
    const panel = doc.querySelector('.problems');
    if (panel) {
      const h = Math.round(panel.getBoundingClientRect().height);
      try { store.setItem(V13_STORAGE_KEY, String(h)); } catch { /* ok */ }
    }
    e?.preventDefault?.();
  }

  function onDblClick() {
    try { store.removeItem(V13_STORAGE_KEY); } catch { /* ok */ }
    root.style.removeProperty('--problems-h');
  }

  bar.addEventListener('pointerdown', onPointerDown);
  bar.addEventListener('pointermove', onPointerMove);
  bar.addEventListener('pointerup', onPointerUp);
  bar.addEventListener('pointercancel', onPointerUp);
  bar.addEventListener('dblclick', onDblClick);

  return store;
}
