import './style.css';
import { parse, LEGEND } from './level.js';
import { validate } from './validate.js';
import { draw } from './renderer.js';
import { loadTileset } from './tileset.js';

const STORAGE_KEY = 'leveldesigner:v1';
const TILE = 24;
const DEBOUNCE_MS = 120;

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
      <div class="status" id="status">cursor —</div>
      <div class="canvas-wrap"><canvas id="preview"></canvas></div>
      <div class="legend" id="legend"></div>
    </div>
  </div>
  <div class="problems" id="problems"></div>
`;

const src = document.querySelector('#src');
const gutter = document.querySelector('#gutter span');
const rulerCol = document.querySelector('#rulerCol span');
const statusEl = document.querySelector('#status');
const legendEl = document.querySelector('#legend');
const problemsEl = document.querySelector('#problems');
const ctx = document.querySelector('#preview').getContext('2d');

legendEl.innerHTML = Object.entries(LEGEND)
  .map(([g, { name }]) => `<span><b>${g}</b> ${name}</span>`)
  .join('');

// Measure the textarea's monospace character width so the column ruler and
// the CSS guide gradients line up exactly with typed characters.
function charWidth() {
  const f = getComputedStyle(src);
  const c = document.createElement('canvas').getContext('2d');
  c.font = `${f.fontSize} ${f.fontFamily}`;
  return c.measureText('0').width;
}
const CW = charWidth();
document.documentElement.style.setProperty('--cw', `${CW}px`);

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

  const lines = text.split('\n');
  renderGutter(lines.length);
  renderRuler(Math.max(40, ...lines.map((l) => l.length + 1)));

  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    /* storage unavailable: editing still works, just not persisted */
  }
}

function updateCursor() {
  const { line, col } = caretLineCol(src.value, src.selectionStart);
  const gy = line - firstGridLine;
  const inGrid = gy >= 0 && line >= firstGridLine;
  statusEl.textContent = inGrid
    ? `cursor (x ${col}, y ${gy})  ·  line ${line}`
    : `cursor — (header)  ·  line ${line}`;
}

let timer;
src.addEventListener('input', () => {
  updateCursor();
  clearTimeout(timer);
  timer = setTimeout(run, DEBOUNCE_MS);
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

src.value = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) || SAMPLE;
  } catch {
    return SAMPLE;
  }
})();
run();
updateCursor();
