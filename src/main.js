import './style.css';
import {
  parse,
  fillRect,
  outlineRect,
  buildLegend,
  setTilesetDirective,
  setBackgroundImageDirective,
  setPickupRequiredDirective,
  setViewportDirective,
  BACKGROUND_GLYPH,
  DEFAULT_LEGEND,
  DEFAULT_TILESET,
} from './level.js';
import { validate } from './validate.js';
import { draw } from './renderer.js';
import { loadTileset } from './tileset.js';
import { createLevels } from './levels.js';
import { openLevelDialog, openConfirm, openPlaySettings } from './loaderDialog.js';
import { testLevel } from './agent/index.js';
import { renderSolutionOverlay } from './agent/overlay.js';
import { openAgentDialog } from './agentDialog.js';
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
        <button id="dlBtn" class="edit-only" title="Download current level as .txt">Download</button>
        <button id="playBtn" class="edit-only" title="Playtest current level (Ctrl/Cmd+Enter)">Play</button>
        <button id="playSettingsBtn" class="edit-only" title="Play settings (pickup requirement, etc.)">Play Settings</button>
        <button id="testBtn" class="edit-only" title="AI agent: does the level have a solution?">Test</button>
        <button id="fitBtn" class="edit-only" title="Fit canvas to available space (toggle)">⛶ Fit</button>
        <button id="themeBtn" class="edit-only" title="Toggle light/dark mode">🌗</button>
        <button id="newBtn" class="edit-only" title="New level (opens the levels dialog)">New</button>
        <label class="level-pick edit-only" title="Switch level (unsaved drafts are guarded)">
          <span>Level:</span>
          <select id="levelSel"></select>
        </label>
        <label class="tileset-pick edit-only" title="Tileset (sets the # tileset: directive)">
          <span>Tileset:</span>
          <select id="tilesetSel"></select>
        </label>
        <button id="restartBtn" class="play-only" title="Restart (R)">Restart</button>
        <button id="exitBtn" class="play-only" title="Exit (Esc)">Exit</button>
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

// Tileset state — declared up here (instead of next to ensureTileset
// below) so renderLegend can safely read `tileset?.lookup` even at its
// FIRST module-init call. Otherwise `let tileset` was in temporal-
// dead-zone when renderLegend ran for the DEFAULT_LEGEND, throwing a
// ReferenceError and leaving the legend visually empty.
let tileset = null;
let activeTilesetId = null;
let tilesetWarn = null;

let activeGlyph = '#';

// v18: friendly group labels per role. Decorations + Foreground glyphs
// merge into a single trailing "Decorations" group together with any
// decoration-image entries from `lookup.images` (the image entries are
// inert in v18 — placement is v19+).
const ROLE_GROUP_ORDER = [
  ['background', 'Empty'],
  ['terrain', 'Terrain'],
  ['player', 'Player'],
  ['exit', 'Exit'],
  ['hazard', 'Hazard'],
  ['pickup', 'Pickup'],
];

// Small attribute/text escape — tileset author content is otherwise
// trustable but defending the legend's innerHTML build is cheap.
const escHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

function renderGlyphButton(g, e) {
  const thumb = e.image
    ? `<img class="thumb" src="${legendBase}${e.image}" alt="" ` +
      `onerror="this.replaceWith(Object.assign(document.createElement('span'),` +
      `{className:'thumb'}))">`
    : `<span class="thumb" style="background:${e.color || 'transparent'}"></span>`;
  const active = g === activeGlyph ? ' active' : '';
  return (
    `<button class="glyph${active}" data-glyph="${escHtml(g)}" title="${escHtml(g)}">` +
    `${thumb}${escHtml(e.name || g)}</button>`
  );
}

function renderLegend() {
  const lookup = tileset?.lookup;
  const parts = [];

  // v22: legend-toolbar with min/max + layout-swap buttons. Placed
  // FIRST so it's always visible (even when the body is hidden).
  parts.push(
    `<div class="legend-toolbar">` +
      `<button class="legend-toggle" data-act="legend-min" ` +
      `title="${legendCollapsed ? 'Expand legend' : 'Minimise legend'}">` +
      `${legendCollapsed ? '▶' : '—'}</button>` +
      `<button class="legend-toggle" data-act="legend-swap" ` +
      `title="Swap legend to ${legendLayout === 'right' ? 'bottom' : 'right'}">↕</button>` +
      `</div>`,
  );
  parts.push('<div class="legend-body">');

  // Background-image dropdown — appears only when the active tileset
  // declares ≥1 `images.<id>` entry with role:"background". Selecting
  // an entry rewrites # background-image: via the pure setter; the
  // (none) option clears the directive and restores the solid SKY fill.
  const bgImages = lookup?.images
    ? Object.entries(lookup.images).filter(([, v]) => v?.role === 'background')
    : [];
  if (bgImages.length) {
    const current = parse(src.value).meta.backgroundImage ?? '';
    const options = [
      `<option value=""${current === '' ? ' selected' : ''}>(none)</option>`,
      ...bgImages.map(
        ([id, def]) =>
          `<option value="${escHtml(id)}"${id === current ? ' selected' : ''}>` +
          `${escHtml(def.name || id)}</option>`,
      ),
    ].join('');
    parts.push(
      `<div class="legend-group">Background:</div>` +
        `<label class="bg-pick"><select id="bgImgSel">${options}</select></label>`,
    );
  }

  // Group glyphs by their resolved v11 role.
  const groupedByRole = {};
  for (const [g, e] of Object.entries(legend)) {
    const role = e.role || 'unknown';
    (groupedByRole[role] ??= []).push([g, e]);
  }

  for (const [role, label] of ROLE_GROUP_ORDER) {
    const entries = groupedByRole[role];
    if (!entries?.length) continue;
    parts.push(`<div class="legend-group">${escHtml(label)}</div>`);
    for (const [g, e] of entries) parts.push(renderGlyphButton(g, e));
  }

  // Decorations group: decoration + foreground glyphs together, then
  // any decoration-images (declared in v18 schema; placement is v19+).
  const decoGlyphs = [
    ...(groupedByRole.decoration ?? []),
    ...(groupedByRole.foreground ?? []),
  ];
  const decoImages = lookup?.images
    ? Object.entries(lookup.images).filter(([, v]) => v?.role === 'decoration')
    : [];
  if (decoGlyphs.length || decoImages.length) {
    parts.push(`<div class="legend-group">Decorations</div>`);
    for (const [g, e] of decoGlyphs) parts.push(renderGlyphButton(g, e));
    for (const [id, def] of decoImages) {
      const thumb = def.image
        ? `<img class="thumb" src="${legendBase}${def.image}" alt="">`
        : `<span class="thumb" style="background:#888"></span>`;
      parts.push(
        `<span class="glyph inert" data-image-id="${escHtml(id)}" ` +
          `title="Decoration image — placement coming in v19+">` +
          `${thumb}${escHtml(def.name || id)}</span>`,
      );
    }
  }

  parts.push('</div>'); // close .legend-body
  legendEl.innerHTML = parts.join('');
}

// v22: legend layout state — right (default) or bottom; collapsed
// or expanded; fit-to-screen on or off. Persisted in localStorage.
// (editorMode is hoisted here so applyFitToScreen() can read it at
// module init — the full play/demo wiring lives further down.)
let editorMode = 'edit';
let legendLayout = readLayoutPref('v22.legendLayout', 'right'); // 'right'|'bottom'
let legendCollapsed = readBoolPref('v22.legendCollapsed', false);
let fitToScreen = readBoolPref('v22.fitToScreen', false);
// v23 M2: light/dark theme — 'dark' default; `body.lightmode` re-binds
// the CSS custom properties (--bg/--fg/--line/--dim/--accent) to a
// pale palette. Persisted; survives reloads.
let theme = readEnumPref('v23.theme', 'dark', ['dark', 'light']);

function readLayoutPref(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v === 'right' || v === 'bottom' ? v : def;
  } catch { return def; }
}
function readBoolPref(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v === 'true';
  } catch { return def; }
}
function readEnumPref(key, def, allowed) {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : def;
  } catch { return def; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* localStorage unavailable */ }
}

function applyTheme() {
  document.body.classList.toggle('lightmode', theme === 'light');
}
applyTheme();

// v23 M3: dashed-rect guide for the play-time viewport. Reads
// parsed.meta.viewport (null = fit-whole, {w,h} = scrolling-window)
// and paints onto the editor's #overlay. Editor-only (run() in
// playmode early-returns before reaching the draw chain that calls
// this).
function drawViewportGuide(octx, parsed, tile) {
  const vp = parsed?.meta?.viewport;
  if (!vp) return;
  const { w: vw, h: vh } = vp;
  // Focus cell: the player spawn (P) when present; otherwise the
  // geometric centre of the world.
  let cc = Math.floor(parsed.meta.width / 2);
  let cr = Math.floor(parsed.meta.height / 2);
  outer:
  for (let r = 0; r < parsed.grid.length; r++) {
    const row = parsed.grid[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 'P') { cc = c; cr = r; break outer; }
    }
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const x = clamp((cc - vw / 2) * tile, 0, Math.max(0, (parsed.meta.width  - vw)) * tile);
  const y = clamp((cr - vh / 2) * tile, 0, Math.max(0, (parsed.meta.height - vh)) * tile);
  octx.save();
  octx.setLineDash([6, 4]);
  octx.strokeStyle = 'rgba(255, 220, 100, 0.9)';
  octx.lineWidth = 2;
  // Inset by 1 px so the dashed stroke renders fully inside the rect.
  octx.strokeRect(x + 1, y + 1, vw * tile - 2, vh * tile - 2);
  octx.restore();
}

const paneRight = document.querySelector('.pane.right');

function applyLegendLayout() {
  paneRight.classList.remove('layout-right', 'layout-bottom');
  paneRight.classList.add(legendLayout === 'right' ? 'layout-right' : 'layout-bottom');
  paneRight.classList.toggle('legend-collapsed', legendCollapsed);
}

function applyFitToScreen() {
  // No-op during play/demo (the v18 CSS-pin owns the canvas size,
  // and v23's applyPlayFitToScreen() owns the optional fit there).
  if (editorMode === 'play' || editorMode === 'demo') return;
  if (!fitToScreen) {
    previewCanvas.style.width = '';
    previewCanvas.style.height = '';
    return;
  }
  const wrap = document.querySelector('.canvas-wrap');
  if (!wrap) return;
  const availW = wrap.clientWidth - 24; // 12px padding × 2
  const availH = wrap.clientHeight - 24;
  if (availW <= 0 || availH <= 0) return;
  const intrinsicW = previewCanvas.width;
  const intrinsicH = previewCanvas.height;
  if (intrinsicW <= 0 || intrinsicH <= 0) return;
  const scale = Math.min(availW / intrinsicW, availH / intrinsicH);
  previewCanvas.style.width = `${Math.floor(intrinsicW * scale)}px`;
  previewCanvas.style.height = `${Math.floor(intrinsicH * scale)}px`;
}

// v23 M4: play-mode CSS pin with optional fit-to-screen. The base
// pin (the v18 fix) is `pinCells * TILE` for width / `pinRows * TILE`
// for height — keeps the canvas at the same on-screen size as the
// editor's intrinsic dims. When fitToScreen is on, multiply both by
// `min(availW / cssW, availH / cssH)` so the canvas grows to fill
// the wrap. tryPlaytest() stashes the cssW/cssH on `currentPlayPin`;
// resize listener re-scales without recomputing pinCells.
let currentPlayPin = null;
function applyPlayFitToScreen() {
  if (!currentPlayPin) return;
  if (editorMode !== 'play' && editorMode !== 'demo') return;
  const { cssW, cssH } = currentPlayPin;
  if (!fitToScreen) {
    previewCanvas.style.width = `${cssW}px`;
    previewCanvas.style.height = `${cssH}px`;
    return;
  }
  const wrap = document.querySelector('.canvas-wrap');
  if (!wrap) return;
  const availW = wrap.clientWidth - 24;
  const availH = wrap.clientHeight - 24;
  if (availW <= 0 || availH <= 0) return;
  const scale = Math.min(availW / cssW, availH / cssH);
  previewCanvas.style.width = `${Math.floor(cssW * scale)}px`;
  previewCanvas.style.height = `${Math.floor(cssH * scale)}px`;
}

applyLegendLayout();
renderLegend();
applyFitToScreen();
legendEl.addEventListener('click', (e) => {
  // v22: layout toggle buttons inside the legend toolbar.
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'legend-min') {
    legendCollapsed = !legendCollapsed;
    writePref('v22.legendCollapsed', legendCollapsed);
    applyLegendLayout();
    renderLegend();
    applyFitToScreen();
    return;
  }
  if (act === 'legend-swap') {
    legendLayout = legendLayout === 'right' ? 'bottom' : 'right';
    writePref('v22.legendLayout', legendLayout);
    applyLegendLayout();
    renderLegend();
    applyFitToScreen();
    return;
  }
  const g = e.target.closest('[data-glyph]')?.dataset.glyph;
  if (g == null) return;
  activeGlyph = g;
  renderLegend();
});
// v18: Background dropdown change → rewrite # background-image: in the
// buffer (undo step via applyEdit) → reflow paints the new BG.
legendEl.addEventListener('change', (e) => {
  if (!e.target.matches('#bgImgSel')) return;
  const id = e.target.value || null;
  const updated = setBackgroundImageDirective(src.value, id);
  if (updated !== src.value) applyEdit(updated);
  reflow();
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
// (The `tileset`/`activeTilesetId`/`tilesetWarn` `let`s themselves are
// declared up next to the legend/legendBase ones — v18 needed them
// initialised before the first renderLegend call, see comment there.)
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
  // v18: PlaytestScene drives the canvas during play mode; the editor's
  // per-frame editorDraw would fight it (alternating frames). Gate the
  // whole pipeline; exitPlaytest() calls run() once on exit to repaint.
  if (editorMode === 'play') return;
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

  // v23 M3: dashed-yellow guide rectangle showing where the play-time
  // viewport (if declared via `# viewport: WxH`) will sit. Centred on
  // the player spawn cell, clamped to world bounds. Editor-only — the
  // guide repaints from this same chain on every reflow.
  drawViewportGuide(octx, parsed, TILE);

  // v22: re-fit if the level dims changed (intrinsic dims drive the
  // scale factor).
  applyFitToScreen();

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
// v18: edit / play mode state machine. In `'play'`, the editor's
// run() is suppressed (PlaytestScene's rAF loop owns the canvas), the
// marquee overlay is detached, the toolbar swaps `.edit-only` buttons
// for `.play-only` (Restart / Exit), and Esc exits.
// (editorMode itself is hoisted near the v22 layout state to keep
// applyFitToScreen() out of the TDZ at module init.)
let playController = null;

// Playtest the LIVE buffer (unsaved edits included). If the launch gate
// blocks (validation error, or no exit to reach), keep the editor open
// and surface the blocking reasons in the problems panel — no play mode.
function tryPlaytest(opts = {}) {
  if (editorMode === 'play' || editorMode === 'demo') return; // already playing — no-op
  const parsed = parse(src.value);
  const r = launchPlaytest(parsed, legend, tileset, previewCanvas, opts);
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
    return;
  }
  // Enter play (or demo) mode. The launcher's rAF loop now drives the
  // canvas; the editor's run() is gated on editorMode === 'edit'.
  // v20: demo mode is the same shape as play mode but driven by a
  // ScriptedInput recording (opts.inputSource); auto-exits when the
  // scene's phase transitions to 'won' or 'dead'.
  editorMode = opts.inputSource ? 'demo' : 'play';
  playController = r;
  // v18 fix: the engine's TILE (20) differs from the editor's TILE
  // (24), so the launcher's resize (gridW*20) leaves #preview ~17%
  // smaller than the editor view. Pin the CSS display width to the
  // editor's intrinsic size so the canvas occupies the same on-screen
  // rectangle in both modes; aspect ratio is preserved from the
  // canvas's width/height attributes (height: auto). Pixel-perfect
  // 1.2× upscale courtesy of `image-rendering: pixelated`. Engine
  // physics (in world units) stays byte-identical to upstream.
  //
  // v19: when `# viewport: WxH` is set, the launcher resizes the
  // canvas to (viewport.w * engineTILE, viewport.h * engineTILE)
  // instead of the whole world. The CSS pin tracks that — using the
  // viewport's width when present so the visible canvas keeps a
  // sensible on-screen size whether the world is bigger or smaller.
  //
  // v23 M4: stash the pin's CSS dims so applyPlayFitToScreen() can
  // re-scale on resize, and honour the editor's fitToScreen flag —
  // when fit is on, the canvas scales to fill the available wrap
  // (preserves aspect). Off-mode = the pinCells*TILE intrinsic
  // (v18/v19 behaviour byte-identical).
  const pinCells = parsed.meta.viewport?.w ?? parsed.meta.width;
  const pinRows  = parsed.meta.viewport?.h ?? parsed.meta.height;
  currentPlayPin = { cssW: pinCells * TILE, cssH: pinRows * TILE };
  document.body.classList.add('playmode');
  applyPlayFitToScreen();
  if (editorMode === 'demo') document.body.classList.add('demomode');
  // Belt-and-braces: clear any stray marquee selection rect.
  octx.clearRect(0, 0, overlay.width, overlay.height);
  // Capture-phase Esc so it wins over textarea / dropdown handlers.
  document.addEventListener('keydown', onPlayEsc, true);
  // v20: in demo mode, auto-exit when the scene transitions to won or
  // dead. Hold the banner for 1.5s so the user can read it.
  if (editorMode === 'demo') startDemoAutoExitWatcher();
}

let demoExitTimer = null;
function startDemoAutoExitWatcher() {
  const watcher = setInterval(() => {
    const phase = playController?.getPhase?.();
    if (phase === 'won' || phase === 'dead') {
      clearInterval(watcher);
      demoExitTimer = setTimeout(() => {
        demoExitTimer = null;
        exitPlaytest();
      }, 1500);
    } else if (!playController) {
      clearInterval(watcher);
    }
  }, 100);
}

function exitPlaytest() {
  if (editorMode !== 'play' && editorMode !== 'demo') return;
  if (demoExitTimer) {
    clearTimeout(demoExitTimer);
    demoExitTimer = null;
  }
  if (playController?.exit) playController.exit();
  playController = null;
  editorMode = 'edit';
  document.body.classList.remove('playmode');
  document.body.classList.remove('demomode');
  document.removeEventListener('keydown', onPlayEsc, true);
  // Release the play-mode display-size pin so the editor's run()
  // below sizes #preview from its (restored) intrinsic dims.
  previewCanvas.style.width = '';
  previewCanvas.style.height = '';
  currentPlayPin = null;
  // Repaint the editor preview — resizes the canvas back to TILE size
  // and re-renders the buffer with the tileset's editor pass.
  run();
  // v22: re-apply fit-to-screen if enabled (run() sized the canvas to
  // intrinsic; fit-mode may want to scale it up).
  applyFitToScreen();
}

function onPlayEsc(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    exitPlaytest();
  }
}

// v17: levels dialog is now opened only via the [New] button (the
// dropdown handles switching). The dialog still has the level list +
// new-level flow + per-row download from v8; v17 just stops using its
// "switch level" entry as the primary path.
document.querySelector('#newBtn').addEventListener('click', openDialog);
document.querySelector('#dlBtn').addEventListener('click', () => downloadLevel(currentId));
// v18: Play Settings dialog → writes # pickup-required: into the buffer
// (as a real undo step via applyEdit). `total` is the level's current
// pickup count, shown for context inside the dialog.
// v19: dialog gains a Viewport row; Save writes BOTH directives in a
// single applyEdit so the undo step covers them as one unit.
document.querySelector('#playSettingsBtn').addEventListener('click', () => {
  const parsed = parse(src.value);
  const total = parsed.grid.reduce(
    (n, row) => n + [...row].filter((ch) => parsed.meta && legend[ch]?.role === 'pickup').length,
    0,
  );
  openPlaySettings({
    pickupRequired: parsed.meta.pickupRequired ?? 'all',
    viewport: parsed.meta.viewport,
    total,
    onSave: ({ pickupRequired, viewport }) => {
      let updated = src.value;
      updated = setPickupRequiredDirective(updated, pickupRequired);
      updated = setViewportDirective(updated, viewport);
      if (updated !== src.value) applyEdit(updated);
    },
  });
});
// v18: play-mode toolbar (visible only via .play-only / .playmode CSS).
document.querySelector('#restartBtn').addEventListener('click', () => {
  if (playController?.restart) playController.restart();
});
document.querySelector('#exitBtn').addEventListener('click', exitPlaytest);
document.querySelector('#playBtn').addEventListener('click', () => tryPlaytest());

// v22: fit-to-screen toggle. Click rotates the boolean; helper applies
// the inline canvas size based on the canvas-wrap's clientWidth/Height.
// Re-fits automatically on legend layout / collapse changes (via the
// legend toolbar handler) and on window resize (debounced below).
const fitBtn = document.querySelector('#fitBtn');
function updateFitBtnState() {
  fitBtn.classList.toggle('active', fitToScreen);
  fitBtn.title = fitToScreen ? 'Fit canvas to screen (currently ON)' : 'Fit canvas to screen (currently OFF)';
}
updateFitBtnState();
fitBtn.addEventListener('click', () => {
  fitToScreen = !fitToScreen;
  writePref('v22.fitToScreen', fitToScreen);
  updateFitBtnState();
  applyFitToScreen();
  // v23 M4: if we're already in play / demo, scale the canvas now
  // (no-op in edit mode — applyFitToScreen above handled that).
  applyPlayFitToScreen();
});

// v23 M2: light/dark theme toggle. The 🌗 button flips `body.lightmode`
// which re-binds the CSS custom properties. Title reflects current
// state so the user knows which mode they're toggling INTO.
const themeBtn = document.querySelector('#themeBtn');
function updateThemeBtnState() {
  themeBtn.title = theme === 'light' ? 'Theme: light (click for dark)' : 'Theme: dark (click for light)';
}
updateThemeBtnState();
themeBtn.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  writePref('v23.theme', theme);
  applyTheme();
  updateThemeBtnState();
});

// v22: window resize re-fits (debounced 50ms; reads clientWidth/Height
// which exclude scrollbars, avoiding feedback loops).
// v23 M4: also re-apply the play-mode pin so a window resize during
// Play / Demo scales the canvas to the new wrap dims.
let _resizeTimer = null;
window.addEventListener('resize', () => {
  if (_resizeTimer) clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    applyFitToScreen();
    applyPlayFitToScreen();
    _resizeTimer = null;
  }, 50);
});

// v21: [Test] button runs the AI agent on the current buffer.
// The agent dialog opens IMMEDIATELY in a "searching" state with a
// live 5-second countdown. The dialog drives runAgent (an async
// callback that calls testLevel with maxRuntimeMs + onProgress +
// signal). On failure, the dialog offers Try 10/15/20s escalation
// buttons; each re-invokes runAgent with the larger budget.
document.querySelector('#testBtn').addEventListener('click', () => {
  const parsed = parse(src.value);
  // v22 M5: testmode hides the legend (same CSS rule as playmode /
  // demomode). Cleared in onClose; the dialog calls onClose for both
  // success-close and failure-close so we don't need a per-state hook.
  document.body.classList.add('testmode');
  // v22 M5 fit kicked off the re-fit synchronously; v23 M4 wraps it
  // in rAF so the layout has recalc'd post-testmode-class-add. The
  // pre-rAF synchronous call kept the canvas "squashed" relative to
  // the now-wider wrap; the rAF defer fixes that.
  requestAnimationFrame(() => applyFitToScreen());
  openAgentDialog({
    runAgent: (maxRuntimeMs, onProgress, signal) =>
      testLevel(parsed, legend, tileset, { maxRuntimeMs, onProgress, signal }),
    onResult: (result /* , budgetMs */) => {
      // Paint the path overlay on success; clear on failure (a
      // previous success may have left the overlay populated and the
      // user is now in escalation).
      octx.clearRect(0, 0, overlay.width, overlay.height);
      if (result.ok) renderSolutionOverlay(octx, result.solution, TILE);
    },
    onDemo: (recording) => tryPlaytest({ inputSource: recording }),
    onClose: () => {
      document.body.classList.remove('testmode');
      requestAnimationFrame(() => applyFitToScreen()); // legend track restored → re-fit
      octx.clearRect(0, 0, overlay.width, overlay.height);
    },
  });
});

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
