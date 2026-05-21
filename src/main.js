import './style.css';
import {
  parse,
  fillRect,
  outlineRect,
  buildLegend,
  setTilesetDirective,
  BACKGROUND_GLYPH,
  DEFAULT_LEGEND,
  DEFAULT_TILESET,
} from './level.js';
import { validate } from './validate.js';
import { draw } from './renderer.js';
import { loadTileset } from './tileset.js';
import { createLevels } from './levels.js';
import { openLevelDialog, openConfirm } from './loaderDialog.js';
import { downloadText } from './download.js';
import { createHistory } from './history.js';
import { launchPlaytest } from './play/launcher.js';
import { setupSplitter, setupProblemsSplitter } from './splitter.js';
import { summariseIssues } from './summarise.js';

const TILE = 24;
const DEBOUNCE_MS = 120;
// Vite's deploy base for absolute fetch paths (see src/levels.js).
const BASE = import.meta.env?.BASE_URL ?? '/';

// Fallback only if the manifest/level fetch fails (offline, bad deploy).
const SAMPLE = `# name: tutorial-01
# size: 24x10
########################
#......................#
#...P.............E....#
#.................######
#.......oooo...........#
#......######..........#
#......................#
#..........^^^.........#
#......................#
########################`;

document.querySelector('#app').innerHTML = `
  <div class="editor">
    <div class="pane left">
      <div class="ruler-col" id="rulerCol"><span></span></div>
      <div class="edit-area">
        <div class="gutter" id="gutter"><span></span></div>
        <textarea id="src" spellcheck="false" autocomplete="off"></textarea>
      </div>
    </div>
    <div class="splitter" id="splitter" title="Drag to resize panes · double-click to reset"></div>
    <div class="pane right">
      <div class="status">
        <button id="dlBtn" title="Download current level as .txt">Download</button>
        <button id="playBtn" title="Playtest current level (Ctrl/Cmd+Enter)">Play</button>
        <button id="newBtn" title="New level (opens the levels dialog)">New</button>
        <label class="level-pick" title="Switch level (unsaved drafts are guarded)">
          <span>Level:</span>
          <select id="levelSel"></select>
        </label>
        <label class="tileset-pick" title="Tileset (sets the # tileset: directive)">
          <span>Tileset:</span>
          <select id="tilesetSel"></select>
        </label>
        <span id="dirty"></span>
      </div>
      <div class="canvas-wrap">
        <div class="stage">
          <canvas id="preview"></canvas>
          <canvas id="overlay"></canvas>
        </div>
      </div>
      <div class="legend" id="legend" title="Click a glyph to draw with it · drag on the preview to fill · hold Shift to draw an outline"></div>
    </div>
  </div>
  <div class="splitter-h" id="splitterH" title="Drag to resize · double-click to reset"></div>
  <div class="problems" id="problems"></div>
`;

const src = document.querySelector('#src');
const gutter = document.querySelector('#gutter span');
const rulerCol = document.querySelector('#rulerCol span');
const cursorEl = document.querySelector('#cursor');
const dirtyEl = document.querySelector('#dirty');
const tilesetSel = document.querySelector('#tilesetSel');
const legendEl = document.querySelector('#legend');
const problemsEl = document.querySelector('#problems');
const previewCanvas = document.querySelector('#preview');
const overlay = document.querySelector('#overlay');
const ctx = previewCanvas.getContext('2d');
const octx = overlay.getContext('2d');

// v12: wire the splitter as soon as the DOM exists, before any async
// work — so the saved pane ratio is applied on the very first paint
// (no flash from the 50/50 default to the persisted width).
setupSplitter();
// v13: sibling splitter for the problems panel (vertical).
setupProblemsSplitter();

// The active char-keyed legend + the tileset base for thumbnail URLs. Both
// start on the Dirt default so the first paint (before any async tileset
// load) is identical to v7; `syncTileset` swaps them per level (v8 M4).
let legend = DEFAULT_LEGEND;
let legendBase = `${BASE}data/tilesets/${DEFAULT_TILESET}/`;

let activeGlyph = '#';
function renderLegend() {
  legendEl.innerHTML = Object.entries(legend)
    .map(([g, e]) => {
      const thumb = e.image
        ? `<img class="thumb" src="${legendBase}${e.image}" alt="" ` +
          `onerror="this.replaceWith(Object.assign(document.createElement('span'),` +
          `{className:'thumb'}))">`
        : `<span class="thumb" style="background:${e.color || 'transparent'}"></span>`;
      return (
        `<button class="glyph${g === activeGlyph ? ' active' : ''}" data-glyph="${g}">` +
        `${thumb}<b>${g === ' ' ? '·' : g}</b> ${e.name}</button>`
      );
    })
    .join('');
}
renderLegend();
legendEl.addEventListener('click', (e) => {
  const g = e.target.closest('[data-glyph]')?.dataset.glyph;
  if (g == null) return;
  activeGlyph = g;
  renderLegend();
});

// Measure the textarea's monospace character width so the column ruler and
// the CSS guide gradients line up exactly with typed characters.
function charWidth() {
  const f = getComputedStyle(src);
  const c = document.createElement('canvas').getContext('2d');
  c.font = `${f.fontSize} ${f.fontFamily}`;
  return c.measureText('0').width;
}
document.documentElement.style.setProperty('--cw', `${charWidth()}px`);

// Per-level tileset, loaded lazily and cached by id so switching back to a
// set never refetches (the common path: every shipped level is Dirt → one
// load). `tilesetWarn` is a synthetic problem appended when a level names a
// tileset that could not be loaded (it falls back to Dirt, never crashes).
let tileset = null;
let activeTilesetId = null;
let tilesetWarn = null;
const tilesetCache = new Map(); // id -> Promise<{ tileset, legend, base, ok }>

function ensureTileset(id) {
  let p = tilesetCache.get(id);
  if (!p) {
    p = loadTileset(id).then((t) => {
      const ok = !!t.lookup;
      return {
        tileset: t,
        legend: ok ? buildLegend(t.lookup) : DEFAULT_LEGEND,
        // An unknown/failed lookup falls back to the Dirt-relative
        // DEFAULT_LEGEND, so its thumbnails must resolve against Dirt.
        base: `${BASE}data/tilesets/${ok ? id : DEFAULT_TILESET}/`,
        ok,
      };
    });
    tilesetCache.set(id, p);
  }
  return p;
}

// Make the active tileset/legend match `id`. No-op (no await) when unchanged,
// so the per-edit reflow stays cheap unless the `# tileset:` line changed.
async function syncTileset(id) {
  if (id === activeTilesetId) return;
  const r = await ensureTileset(id);
  activeTilesetId = id;
  tileset = r.tileset;
  legend = r.legend;
  legendBase = r.base;
  // v14: expose readiness so the Playwright playtest spec can wait for
  // the active tileset to be loaded before pressing Play. Live users
  // never need this — they take seconds to click Play after page load
  // — but tests fire input immediately and would otherwise race the
  // async tileset fetch.
  if (typeof window !== 'undefined') window.__activeTileset = tileset;
  // Only nag when a level explicitly named a set we couldn't load; a failed
  // *default* (offline Dirt) is the pre-existing degrade-to-shapes path.
  tilesetWarn =
    !r.ok && id !== DEFAULT_TILESET
      ? { line: 1, col: 1, severity: 'warn', message: `unknown tileset '${id}', using default` }
      : null;
  renderLegend();
}

// Sync the tileset for the current buffer, then repaint. Used wherever the
// buffer's `# tileset:` may have changed (load/switch, debounced edit, undo).
async function reflow() {
  await syncTileset(parse(src.value).meta.tileset);
  syncTilesetMenu();
  run();
}

// --- Tileset menu (v9+) -------------------------------------------------
// A toolbar <select> driven by the tilesets manifest. Selecting an entry
// rewrites the buffer's `# tileset:` directive via the pure setTileset-
// Directive helper, then reflows so the new lookup is loaded and the
// legend updates. Levels that name a tileset not in the manifest (offline
// /missing) still appear in the menu as "<id> (missing)" so the active
// state is honest.
const escAttr = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

async function populateTilesetMenu() {
  const list = await levels.tilesets();
  const items = list.length
    ? list
    : [{ id: DEFAULT_TILESET, name: 'Dirt Platformer Tiles' }];
  tilesetSel.innerHTML = items
    .map((t) => `<option value="${escAttr(t.id)}">${escAttr(t.name)}</option>`)
    .join('');
}

function syncTilesetMenu() {
  const id = parse(src.value).meta.tileset;
  if (![...tilesetSel.options].some((o) => o.value === id)) {
    tilesetSel.insertAdjacentHTML(
      'beforeend',
      `<option value="${escAttr(id)}">${escAttr(id)} (missing)</option>`,
    );
  }
  if (tilesetSel.value !== id) tilesetSel.value = id;
}

// --- Level menu (v17) ----------------------------------------------------
// Replaces the v8 "Levels" button + dialog as the everyday way to switch
// levels. The dialog is still reachable via the [New] button — both
// flows route through `switchTo()` / the v8 unsaved-changes guard.
const levelSel = document.querySelector('#levelSel');

function populateLevelMenu() {
  const list = levels.list();
  levelSel.innerHTML = list
    .map(
      (l) =>
        `<option value="${escAttr(l.id)}">${l.modified ? '● ' : ''}${escAttr(l.name)}</option>`,
    )
    .join('');
}

// Sync the dropdown's selected option with the active buffer's
// `currentId`. Re-populates first so a freshly-saved draft picks up
// its ● modified marker on the next sync.
function syncLevelMenu() {
  populateLevelMenu();
  const id = currentId;
  if (id == null) {
    // Untitled buffer (just-created via New, or the offline sample).
    // Show a sticky synthetic option so the dropdown is honest.
    if (![...levelSel.options].some((o) => o.value === '')) {
      levelSel.insertAdjacentHTML(
        'beforeend',
        `<option value="">(untitled)</option>`,
      );
    }
    levelSel.value = '';
    return;
  }
  if (![...levelSel.options].some((o) => o.value === id)) {
    levelSel.insertAdjacentHTML(
      'beforeend',
      `<option value="${escAttr(id)}">${escAttr(id)} (missing)</option>`,
    );
  }
  if (levelSel.value !== id) levelSel.value = id;
}

const caretLineCol = (value, pos) => {
  const before = value.slice(0, pos).split('\n');
  return { line: before.length, col: before[before.length - 1].length };
};

const lineColToCaret = (value, line, col) => {
  const lines = value.split('\n');
  let pos = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
  return pos + col;
};

function renderRuler(maxCols) {
  let s = '';
  for (let i = 0; i < maxCols; i++) {
    s += i % 10 === 0 ? '|' : i % 5 === 0 ? '+' : '·';
  }
  rulerCol.textContent = s;
}

function renderGutter(lineCount) {
  let s = '';
  for (let i = 1; i <= lineCount; i++) s += `${i}\n`;
  gutter.textContent = s;
}

// v17: the problems panel is a single-line, fixed-height summary bar.
// Click-to-jump is retired (the textarea is hidden); errors take
// priority over warnings; a `+N more` suffix surfaces additional
// issues without listing them. CSS keys off `data-severity` for tint.
function renderProblems(issues) {
  const { text, severity } = summariseIssues(issues);
  problemsEl.textContent = text;
  problemsEl.dataset.severity = severity;
}

let firstGridLine = 1;

function run() {
  const text = src.value;
  const parsed = parse(text);
  firstGridLine = parsed.rows[0]?.line ?? 1;

  const issues = validate(parsed, legend);
  if (tilesetWarn) issues.push(tilesetWarn);
  renderProblems(issues);
  draw(ctx, parsed, tileset, TILE);

  // Keep the selection overlay congruent with the (re-sized) preview.
  if (overlay.width !== ctx.canvas.width) overlay.width = ctx.canvas.width;
  if (overlay.height !== ctx.canvas.height) overlay.height = ctx.canvas.height;
  octx.clearRect(0, 0, overlay.width, overlay.height);

  const lines = text.split('\n');
  renderGutter(lines.length);
  renderRuler(Math.max(40, ...lines.map((l) => l.length + 1)));
}

function updateCursor() {
  // v17: the #cursor span was removed from the toolbar (the text
  // pane is hidden, so a caret position is meaningless). cursorEl
  // is null; we no-op rather than throw, and the helper itself
  // stays because it's still called from several listeners. A v18
  // cleanup could fully remove this + caretLineCol + lineColToCaret.
  if (!cursorEl) return;
  const { line, col } = caretLineCol(src.value, src.selectionStart);
  const gy = line - firstGridLine;
  const inGrid = gy >= 0 && line >= firstGridLine;
  cursorEl.textContent = inGrid
    ? `cursor (x ${col}, y ${gy})  ·  line ${line}`
    : `cursor — (header)  ·  line ${line}`;
}

function refreshDirty() {
  const dirty = levels.isDirty(src.value);
  dirtyEl.textContent = dirty ? '● unsaved' : '';
  return dirty;
}

let timer;
src.addEventListener('input', () => {
  updateCursor();
  refreshDirty();
  clearTimeout(timer);
  timer = setTimeout(() => {
    reflow(); // re-syncs the tileset only if the `# tileset:` line changed
    history.push(src.value); // commit a snapshot once typing settles
  }, DEBOUNCE_MS);
});
for (const ev of ['keyup', 'click', 'select']) {
  src.addEventListener(ev, updateCursor);
}
document.addEventListener('selectionchange', () => {
  if (document.activeElement === src) updateCursor();
});

// Keep the gutter and column ruler aligned with the textarea's scroll.
src.addEventListener('scroll', () => {
  gutter.style.transform = `translateY(${-src.scrollTop}px)`;
  rulerCol.style.transform = `translateX(${-src.scrollLeft}px)`;
});

// --- Level library wiring ----------------------------------------------

// localStorage can throw (privacy mode); degrade to an in-memory shim so the
// editor still works, just without persistence.
const storage = (() => {
  try {
    const k = '__ld_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const m = new Map();
    return {
      getItem: (x) => (m.has(x) ? m.get(x) : null),
      setItem: (x, v) => m.set(x, String(v)),
      removeItem: (x) => m.delete(x),
    };
  }
})();

const levels = createLevels({ fetch: (...a) => fetch(...a), storage });
let currentId = null;
const history = createHistory({ limit: 100 });

function setBuffer(text, id) {
  src.value = text;
  currentId = id;
  if (id) levels.setLastOpen(id);
  history.reset(text); // each loaded level gets a fresh undo timeline
  run(); // immediate paint with the current legend …
  reflow(); // … then swap to this level's tileset/legend when it loads
  updateCursor();
  refreshDirty();
  syncLevelMenu(); // v17: keep the toolbar dropdown in sync with the buffer
}

// Restore a buffer from the history stack (no reset — keeps the timeline).
function applyHistory(text) {
  if (text == null) return;
  src.value = text;
  reflow(); // an undone/redone state may name a different tileset
  updateCursor();
  refreshDirty();
}

async function loadInto(id) {
  try {
    setBuffer(await levels.load(id), id);
  } catch {
    /* keep current buffer if the level fails to load */
  }
}

// Run `proceed` only after the current buffer's unsaved edits are dealt
// with (shared by level-switch and new-level). A null currentId (offline
// sample / freshly-created) has no draft to save, so it proceeds directly,
// matching the pre-v8 switch behaviour. v17: optional `onCancel` lets the
// caller handle Cancel specifically (e.g. the level dropdown snaps its
// value back); when omitted, the default re-opens the levels dialog —
// the pre-v17 behaviour, preserved for back-compat with `newLevel`.
function guardUnsaved(proceed, onCancel) {
  if (currentId && refreshDirty()) {
    openConfirm({
      message: `“${currentId}” has unsaved changes.`,
      actions: [
        { label: 'Save draft & continue', value: 'save', primary: true },
        { label: 'Discard & continue', value: 'discard' },
        { label: 'Cancel', value: 'cancel' },
      ],
      onChoice: (choice) => {
        if (choice === 'cancel') return onCancel ? onCancel() : openDialog();
        if (choice === 'save') levels.save(currentId, src.value);
        proceed();
      },
    });
    return;
  }
  proceed();
}

// Switch levels, guarding unsaved edits in the current buffer.
async function switchTo(id) {
  if (id === currentId) return;
  guardUnsaved(() => loadInto(id));
}

// Build a blank level for the chosen tileset + size and load it unsaved
// (currentId = null, like the offline sample) so it can't clobber a draft.
function newLevel({ id, w, h }) {
  guardUnsaved(() => {
    const head = ['# name: untitled', `# size: ${w}x${h}`];
    if (id && id !== DEFAULT_TILESET) head.push(`# tileset: ${id}`);
    const row = BACKGROUND_GLYPH.repeat(w);
    setBuffer([...head, ...Array.from({ length: h }, () => row)].join('\n'), null);
  });
}

async function downloadLevel(id) {
  // Current buffer for the open level (may be unsaved); peek others without
  // disturbing the dirty baseline.
  const text = id && id !== currentId ? await levels.peek(id) : src.value;
  downloadText(id || currentId, text);
}

function openDialog() {
  openLevelDialog({
    levels,
    currentId,
    onSelect: switchTo,
    onDownload: downloadLevel,
    onNew: newLevel,
  });
}

window.addEventListener('beforeunload', (e) => {
  if (currentId && levels.isDirty(src.value)) {
    e.preventDefault();
    e.returnValue = '';
  }
});
// Playtest the LIVE buffer (unsaved edits included). If the launch gate
// blocks (validation error, or no exit to reach), keep the editor open and
// surface the blocking reasons in the existing problems panel — no overlay.
function tryPlaytest() {
  const parsed = parse(src.value);
  // v14: hand the active tileset to playtest so it renders with the
  // same art the editor preview uses, not the play-assets sprites.
  const r = launchPlaytest(parsed, legend, tileset);
  if (!r.ok) {
    const issues = validate(parsed, legend);
    if (tilesetWarn) issues.push(tilesetWarn);
    const extra = r.reasons.filter(
      (rs) => !issues.some((i) => i.message === rs.message),
    );
    renderProblems([...issues, ...extra]);
    problemsEl.classList.remove('flash');
    void problemsEl.offsetWidth; // restart the CSS animation
    problemsEl.classList.add('flash');
  }
}

// v17: levels dialog is now opened only via the [New] button (the
// dropdown handles switching). The dialog still has the level list +
// new-level flow + per-row download from v8; v17 just stops using its
// "switch level" entry as the primary path.
document.querySelector('#newBtn').addEventListener('click', openDialog);
document.querySelector('#dlBtn').addEventListener('click', () => downloadLevel(currentId));
document.querySelector('#playBtn').addEventListener('click', tryPlaytest);
levelSel.addEventListener('change', () => {
  const next = levelSel.value;
  if (next === '' || next === currentId) return; // untitled / no-op
  // Guard with onCancel that snaps the dropdown back rather than
  // opening a dialog that no longer fits the v17 toolbar model.
  guardUnsaved(
    () => loadInto(next),
    () => { syncLevelMenu(); },
  );
});
tilesetSel.addEventListener('change', () => {
  const next = tilesetSel.value;
  const updated = setTilesetDirective(src.value, next, DEFAULT_TILESET);
  if (updated !== src.value) applyEdit(updated); // history step + run()
  reflow(); // load the new lookup → swap legend → sync the select label
});
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  const k = e.key.toLowerCase();
  if (k === 'o') {
    e.preventDefault();
    openDialog();
  } else if (k === 'enter') {
    e.preventDefault();
    tryPlaytest();
  } else if (k === 'z' && !e.shiftKey) {
    e.preventDefault(); // own the undo so native textarea undo can't diverge
    applyHistory(history.undo(src.value));
  } else if ((k === 'z' && e.shiftKey) || k === 'y') {
    e.preventDefault();
    applyHistory(history.redo());
  }
});

// --- Rectangle draw tool -----------------------------------------------

// Commit a buffer change as one undoable step (distinct from applyHistory,
// which restores without re-pushing).
function applyEdit(text) {
  src.value = text;
  history.push(text);
  run();
  updateCursor();
  refreshDirty();
}

// Pointer position → clamped grid cell. The overlay shares the preview's
// intrinsic size (gridW*TILE) but is CSS-scaled, so divide by that ratio.
function cellFromEvent(e) {
  const r = overlay.getBoundingClientRect();
  const gx = ((e.clientX - r.left) * (overlay.width / r.width)) / TILE;
  const gy = ((e.clientY - r.top) * (overlay.height / r.height)) / TILE;
  const W = Math.max(1, Math.round(overlay.width / TILE));
  const H = Math.max(1, Math.round(overlay.height / TILE));
  return {
    cx: Math.max(0, Math.min(W - 1, Math.floor(gx))),
    cy: Math.max(0, Math.min(H - 1, Math.floor(gy))),
  };
}

function drawMarquee(a, b) {
  const x0 = Math.min(a.cx, b.cx);
  const x1 = Math.max(a.cx, b.cx);
  const y0 = Math.min(a.cy, b.cy);
  const y1 = Math.max(a.cy, b.cy);
  octx.clearRect(0, 0, overlay.width, overlay.height);
  octx.fillStyle = 'rgba(255,255,255,0.18)';
  octx.fillRect(x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);
  octx.strokeStyle = 'rgba(255,255,255,0.9)';
  octx.lineWidth = 2;
  octx.strokeRect(
    x0 * TILE + 1,
    y0 * TILE + 1,
    (x1 - x0 + 1) * TILE - 2,
    (y1 - y0 + 1) * TILE - 2,
  );
}

// The buffer↔grid splice: parse → edit the grid rows → write each changed
// row back at its ORIGINAL file line (parsed.rows[i].line), so the header
// and any interspersed `//` comments are preserved.
function applyRect(a, b, outline) {
  const parsed = parse(src.value);
  if (!parsed.grid.length) return;
  const edit = outline ? outlineRect : fillRect;
  const grid = edit(parsed.grid, a.cx, a.cy, b.cx, b.cy, activeGlyph);
  const lines = src.value.split('\n');
  parsed.rows.forEach((row, i) => {
    lines[row.line - 1] = grid[i];
  });
  applyEdit(lines.join('\n'));
}

let dragStart = null;
overlay.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  dragStart = cellFromEvent(e);
  overlay.setPointerCapture(e.pointerId);
  drawMarquee(dragStart, dragStart);
});
overlay.addEventListener('pointermove', (e) => {
  if (dragStart) drawMarquee(dragStart, cellFromEvent(e));
});
overlay.addEventListener('pointerup', (e) => {
  if (!dragStart) return;
  const start = dragStart;
  dragStart = null;
  octx.clearRect(0, 0, overlay.width, overlay.height);
  applyRect(start, cellFromEvent(e), e.shiftKey);
});
overlay.addEventListener('pointercancel', () => {
  dragStart = null;
  octx.clearRect(0, 0, overlay.width, overlay.height);
});

(async function start() {
  try {
    await levels.init();
    await populateTilesetMenu(); // before setBuffer so the first reflow finds options
    populateLevelMenu(); // v17: build the Level dropdown's options before any setBuffer
    const list = levels.list();
    const startId =
      (levels.lastOpen() && list.some((l) => l.id === levels.lastOpen())
        ? levels.lastOpen()
        : null) || list[0]?.id;
    if (startId) {
      setBuffer(await levels.load(startId), startId);
      return;
    }
  } catch {
    /* fall through to the offline sample */
  }
  setBuffer(SAMPLE, null);
})();
