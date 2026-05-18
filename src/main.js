import './style.css';
import { parse, LEGEND, fillRect, outlineRect } from './level.js';
import { validate } from './validate.js';
import { draw } from './renderer.js';
import { loadTileset } from './tileset.js';
import { createLevels } from './levels.js';
import { openLevelDialog, openConfirm } from './loaderDialog.js';
import { downloadText } from './download.js';
import { createHistory } from './history.js';

const TILE = 24;
const DEBOUNCE_MS = 120;

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
    <div class="pane right">
      <div class="status">
        <button id="levelsBtn" title="Open level (Ctrl/Cmd+O)">Levels</button>
        <button id="dlBtn" title="Download current level as .txt">Download</button>
        <span id="cursor">cursor —</span>
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
  <div class="problems" id="problems"></div>
`;

const src = document.querySelector('#src');
const gutter = document.querySelector('#gutter span');
const rulerCol = document.querySelector('#rulerCol span');
const cursorEl = document.querySelector('#cursor');
const dirtyEl = document.querySelector('#dirty');
const legendEl = document.querySelector('#legend');
const problemsEl = document.querySelector('#problems');
const previewCanvas = document.querySelector('#preview');
const overlay = document.querySelector('#overlay');
const ctx = previewCanvas.getContext('2d');
const octx = overlay.getContext('2d');

let activeGlyph = '#';
function renderLegend() {
  legendEl.innerHTML = Object.entries(LEGEND)
    .map(
      ([g, { name }]) =>
        `<button class="glyph${g === activeGlyph ? ' active' : ''}" data-glyph="${g}">` +
        `<b>${g === ' ' ? '·' : g}</b> ${name}</button>`,
    )
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

let tileset = null;
loadTileset().then((t) => {
  tileset = t;
  run();
});

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

function renderProblems(issues) {
  if (!issues.length) {
    problemsEl.innerHTML = `<div class="ok">No problems.</div>`;
    return;
  }
  problemsEl.innerHTML = issues
    .map(
      (p, i) =>
        `<div class="row" data-i="${i}"><span class="loc">${p.line}:${p.col}</span> ` +
        `<span class="${p.severity}">${p.severity}</span> ${p.message}</div>`,
    )
    .join('');
  problemsEl.querySelectorAll('.row').forEach((row) => {
    row.addEventListener('click', () => {
      const p = issues[Number(row.dataset.i)];
      src.focus();
      const pos = lineColToCaret(src.value, p.line, p.col - 1);
      src.setSelectionRange(pos, pos);
      updateCursor();
    });
  });
}

let firstGridLine = 1;

function run() {
  const text = src.value;
  const parsed = parse(text);
  firstGridLine = parsed.rows[0]?.line ?? 1;

  renderProblems(validate(parsed));
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
    run();
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
  run();
  updateCursor();
  refreshDirty();
}

// Restore a buffer from the history stack (no reset — keeps the timeline).
function applyHistory(text) {
  if (text == null) return;
  src.value = text;
  run();
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

// Switch levels, guarding unsaved edits in the current buffer.
async function switchTo(id) {
  if (id === currentId) return;

  if (currentId && refreshDirty()) {
    openConfirm({
      message: `“${currentId}” has unsaved changes.`,
      actions: [
        { label: 'Save draft & switch', value: 'save', primary: true },
        { label: 'Discard & switch', value: 'discard' },
        { label: 'Cancel', value: 'cancel' },
      ],
      onChoice: (choice) => {
        if (choice === 'cancel') return openDialog(); // back to the list
        if (choice === 'save') levels.save(currentId, src.value);
        loadInto(id);
      },
    });
    return;
  }
  loadInto(id);
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
  });
}

window.addEventListener('beforeunload', (e) => {
  if (currentId && levels.isDirty(src.value)) {
    e.preventDefault();
    e.returnValue = '';
  }
});
document.querySelector('#levelsBtn').addEventListener('click', openDialog);
document.querySelector('#dlBtn').addEventListener('click', () => downloadLevel(currentId));
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  const k = e.key.toLowerCase();
  if (k === 'o') {
    e.preventDefault();
    openDialog();
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
