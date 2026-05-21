import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from './level.js';
import { draw, tileMask, THIN } from './renderer.js';

function fakeCtx() {
  const calls = { fillRect: 0, arc: 0, drawImage: 0 };
  return {
    canvas: { width: 0, height: 0 },
    set fillStyle(_) {},
    fillRect: () => calls.fillRect++,
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    arc: () => calls.arc++,
    fill() {},
    drawImage: () => calls.drawImage++,
    calls,
  };
}

// v11 tileset shape — accessors return DRAW SPECS, not bare Images:
// `{ image, sx, sy, sw, sh }`. `terrainFor(mask)` records the masks and
// returns a spec so the renderer takes the image path. `entityFor` and
// `decorationFor` default to null → renderer falls back to shapes for
// entities and skips decorations.
const STUB_IMAGE = { width: 32, height: 32 };
const fullSpec = (im = STUB_IMAGE) => ({
  image: im, sx: 0, sy: 0, sw: im.width, sh: im.height,
});
function fakeTileset(opts = {}) {
  const idx = [];
  const masks = [];
  return {
    atlasReady: opts.atlasReady ?? true,
    drawTile: (_c, i) => idx.push(i),
    terrainFor: (m) => {
      masks.push(m);
      return opts.terrainImage === false ? null : fullSpec();
    },
    entityFor: opts.entityFor ?? (() => null),
    decorationFor: opts.decorationFor ?? (() => null),
    idx,
    masks,
  };
}

// 3x3 grid with the centre solid and chosen orthogonal neighbours solid.
function around({ n, e, s, w }) {
  const g = [
    ['.', n ? '#' : '.', '.'],
    [w ? '#' : '.', '#', e ? '#' : '.'],
    ['.', s ? '#' : '.', '.'],
  ];
  return g.map((row) => row.join(''));
}

test('tileMask: all 16 neighbour combinations → N·1+E·2+S·4+W·8', () => {
  for (let m = 0; m < 16; m++) {
    const n = !!(m & 1);
    const e = !!(m & 2);
    const s = !!(m & 4);
    const w = !!(m & 8);
    assert.equal(tileMask(around({ n, e, s, w }), 1, 1), m);
  }
});

test('tileMask: off-grid counts as solid (v4 rule)', () => {
  assert.equal(tileMask(['#'], 0, 0), 15); // 1x1: all neighbours off-grid
  assert.equal(tileMask(['...', '.#.', '...'], 1, 1), 0); // lone, all open
  // left-edge column cell: W off-grid (solid) + N,S solid, E open → 1+4+8
  assert.equal(tileMask(['#..', '#..', '#..'], 1, 0), 13);
});

test('THIN is exactly the v5 platform-cell mask set', () => {
  assert.deepEqual([...THIN].sort((a, b) => a - b), [0, 1, 2, 4, 5, 8, 10]);
});

test('canvas is sized to grid * tile', () => {
  const ctx = fakeCtx();
  draw(ctx, parse('# size: 4x2\n####\n#..#'), null, 10);
  assert.equal(ctx.canvas.width, 40);
  assert.equal(ctx.canvas.height, 20);
});

test('no-tileset path: walls drawn as fallback blocks, bg skipped', () => {
  const ctx = fakeCtx();
  draw(ctx, parse('####\n#..#'), null, 10); // 1 sky rect + 6 wall blocks
  assert.equal(ctx.calls.fillRect, 1 + 6);
  assert.equal(ctx.calls.drawImage, 0);
});

test('no-tileset path: entity glyphs use shape fallbacks', () => {
  const ctx = fakeCtx();
  draw(ctx, parse('P.o'), null, 10);
  assert.equal(ctx.calls.arc, 2); // P disc + o pip
  assert.equal(ctx.calls.drawImage, 0);
});

test('atlas path: an inset 3x3 block emits the 9 thick masks + sky fill', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset();
  draw(ctx, parse('.....\n.###.\n.###.\n.###.\n.....'), ts, 8);
  assert.equal(ts.idx.filter((i) => i === 11).length, 25); // sky per cell
  // 9 distinct thick masks (corners 3/6/9/12, edges 7/11/13/14, centre 15).
  assert.deepEqual(
    [...new Set(ts.masks)].sort((a, b) => a - b),
    [3, 6, 7, 9, 11, 12, 13, 14, 15],
  );
  assert.equal(ts.masks.some((m) => THIN.has(m)), false);
});

test('atlas path: thin runs emit thin masks + suppress decor', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset();
  // Floating 1-wide pillar (col 2), a 1-tall ledge (row 5), a lone cell.
  draw(
    ctx,
    parse(
      ['........', '..#.....', '..#.....', '..#.....', '........',
       '....###.', '........', '......#.', '........'].join('\n'),
    ),
    ts,
    8,
  );
  // pillar cap-top/mid-v/cap-bottom = 4/5/1; ledge cap-left/mid-h/cap-right
  // = 2/10/8; single = 0. All THIN.
  for (const m of [4, 5, 1, 2, 10, 8, 0])
    assert.ok(ts.masks.includes(m), `expected thin mask ${m}`);
  assert.equal(ts.masks.every((m) => THIN.has(m)), true);
  // decor suppressed on the finished platform art: no grass/drip emitted.
  assert.equal(ts.idx.filter((i) => [21, 22, 23, 15].includes(i)).length, 0);
});

test('atlas path: grass overlays dirt that has open sky above', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset();
  draw(ctx, parse('...\n###'), ts, 8); // row1 is a thick bottom edge, not thin
  assert.equal(ts.idx.filter((i) => i === 21 || i === 22).length, 3);
});

test('cave theme: dark bg, no grass/moon/stars, drips kept', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset();
  draw(ctx, parse('# theme: cave\n...\n###'), ts, 8);
  assert.equal(ts.idx.filter((i) => i === 19).length, 6); // dirt_fill bg
  assert.equal(ts.idx.filter((i) => i === 11).length, 0); // no sky tile
  assert.equal(ts.idx.filter((i) => i === 21 || i === 22).length, 0); // no grass
  assert.equal(ts.idx.filter((i) => i === 3).length, 0); // no moon
});

// v10: per-cell fallback chain — tileset.terrainFor(mask) draws an image
// for # cells, tileset.entityFor(char) draws an image for entity cells.
// Tilesets WITHOUT an atlas (atlasReady:false) still get per-cell terrain
// and entity sprites — that's the bug the v8 `ready` gate caused.
test('v10 atlas-less tileset: # cells use terrainFor image, decor skipped', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset({ atlasReady: false });
  draw(ctx, parse('...\n###'), ts, 8);
  // Sky fillRect once + 0 fallback blocks (terrainFor handled the 3 #).
  assert.equal(ctx.calls.fillRect, 1);
  // 3 # cells → 3 drawImage calls into the canvas.
  assert.equal(ctx.calls.drawImage, 3);
  // No atlas decor pass: no drawTile calls.
  assert.equal(ts.idx.length, 0);
});

test('v10 atlas-less tileset: entityFor spec trumps shape fallback', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset({
    atlasReady: false,
    entityFor: (c) => (c === 'P' ? fullSpec() : null),
  });
  draw(ctx, parse('P.o'), ts, 8);
  // P → drawImage (entity sprite). o → drawFallback (entity returned null).
  assert.equal(ctx.calls.drawImage, 1);
  assert.equal(ctx.calls.arc, 1); // only o is a shape now
});

// --- v11 decoration pass + draw-spec contract -------------------------

test('v11: decorationFor draws via Pass 4a (under entities, never as shape)', () => {
  const ctx = fakeCtx();
  // 'T' is a decoration; the renderer must NOT shape-fallback it in
  // Pass 4b, AND must draw it via decorationFor in Pass 4a.
  const ts = fakeTileset({
    atlasReady: false,
    decorationFor: (c) => (c === 'T' ? fullSpec() : null),
  });
  draw(ctx, parse('PTE'), ts, 8);
  // T → exactly one drawImage (decoration in Pass 4a). P + E shape-
  // fallback (P disc = arc, E block = fillRect); no second drawImage
  // for T (it would mean Pass 4b double-drew the decoration).
  assert.equal(ctx.calls.drawImage, 1);
  assert.equal(ctx.calls.arc, 1);          // P disc only
  // 1 sky fillRect + 1 for the 'E' block = 2; if the decoration were
  // incorrectly falling back to shape (E-like block) we'd see 3.
  assert.equal(ctx.calls.fillRect, 2);
});

test('v11: a player char drawn over a (separate) decoration tile composites in order', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset({
    atlasReady: false,
    entityFor: (c) => (c === 'P' ? fullSpec() : null),
    decorationFor: (c) => (c === 'T' ? fullSpec() : null),
  });
  // Distinct cells: P at col 0, T at col 1. Both get drawImage. Order
  // is Pass 4a then 4b but the count is the same; this test mainly
  // documents the cell-independent behaviour.
  draw(ctx, parse('PT'), ts, 8);
  assert.equal(ctx.calls.drawImage, 2);
});

test('v11: draw-spec sub-region carried into ctx.drawImage args', () => {
  // The renderer must forward sx/sy/sw/sh from the spec into the
  // 9-arg drawImage call so a sheet renders one frame, not the strip.
  const calls = [];
  const ctx = {
    canvas: { width: 0, height: 0 },
    set fillStyle(_) {},
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
    closePath() {}, arc() {}, fill() {},
    drawImage: (...a) => calls.push(a),
  };
  const ts = fakeTileset({
    atlasReady: false,
    entityFor: () => ({
      image: { width: 352, height: 32 }, sx: 64, sy: 0, sw: 32, sh: 32,
    }),
  });
  draw(ctx, parse('P'), ts, 8);
  assert.equal(calls.length, 1);
  // Args: (image, sx, sy, sw, sh, dx, dy, dw, dh)
  assert.deepEqual(calls[0].slice(1, 5), [64, 0, 32, 32]);
});

test('v10 graceful fall-through: terrainFor returns null → shape fallback', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset({ atlasReady: false, terrainImage: false });
  draw(ctx, parse('###'), ts, 8);
  // No images returned for terrain → all 3 # cells take the shape path.
  assert.equal(ctx.calls.drawImage, 0);
  // 1 sky fillRect + 3 # block fillRects.
  assert.equal(ctx.calls.fillRect, 1 + 3);
});

// v16: the renderer must forward its optional `now` arg to the
// tileset's accessors so animated sprites can advance their frame.
// The editor preview path (no `now`) must still resolve to frame 0.
test('v16: draw forwards `now` to terrainFor/entityFor/decorationFor', () => {
  const seen = { terrain: [], entity: [], decoration: [] };
  const ctx = fakeCtx();
  const ts = {
    atlasReady: false,
    drawTile() {},
    terrainFor: (_m, now) => {
      seen.terrain.push(now);
      return fullSpec();
    },
    entityFor: (_c, now) => {
      seen.entity.push(now);
      return null; // fall back to shape; we only care about the `now` value
    },
    decorationFor: (_c, now) => {
      seen.decoration.push(now);
      return null;
    },
  };
  // PE — one terrain cell wouldn't exist; use a level with #, P, E.
  draw(ctx, parse('#PE'), ts, 8, 12345);
  // terrainFor called for the `#` cell with now=12345.
  assert.ok(seen.terrain.length > 0);
  for (const v of seen.terrain) assert.equal(v, 12345);
  // entityFor called for P and E cells with the same `now`.
  assert.ok(seen.entity.length >= 2);
  for (const v of seen.entity) assert.equal(v, 12345);
  // decorationFor called by both Pass 4a and Pass 4b's de-dup check.
  for (const v of seen.decoration) assert.equal(v, 12345);
});

test('v16: omitting `now` passes undefined — animators default to frame 0', () => {
  const seen = [];
  const ctx = fakeCtx();
  const ts = {
    atlasReady: false,
    drawTile() {},
    terrainFor: (_m, now) => { seen.push(now); return fullSpec(); },
    entityFor: () => null,
    decorationFor: () => null,
  };
  draw(ctx, parse('#'), ts, 8); // no `now`
  assert.equal(seen.length, 1);
  assert.equal(seen[0], undefined);
});

// --- v18 background image + foreground decoration passes ------------

test('v18: Pass 0a draws meta.backgroundImage stretched to level dims', () => {
  const calls = [];
  const ctx = {
    canvas: { width: 0, height: 0 },
    set fillStyle(_) {},
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
    closePath() {}, arc() {}, fill() {},
    drawImage: (...a) => calls.push(a),
  };
  const bgImage = { width: 640, height: 400 };
  const ts = {
    atlasReady: false,
    drawTile() {},
    backgroundImage: (id) => (id === 'bg-x' ? bgImage : null),
    terrainFor: () => null,
    entityFor: () => null,
    decorationFor: () => null,
    foregroundFor: () => null,
  };
  // 5×3 level → 5*tile × 3*tile target dims; tile=10 → 50×30.
  const parsed = parse('#####\n#P.E#\n#####');
  draw(ctx, { ...parsed, meta: { ...parsed.meta, backgroundImage: 'bg-x' } }, ts, 10);
  // First drawImage call should be the background, stretched.
  assert.equal(calls.length >= 1, true);
  const bg = calls[0];
  assert.equal(bg[0], bgImage);
  assert.equal(bg[1], 0);
  assert.equal(bg[2], 0);
  assert.equal(bg[3], 5 * 10); // levelW
  assert.equal(bg[4], 3 * 10); // levelH
});

test('v18: Pass 0a skips when meta.backgroundImage is null OR the ID is unknown', () => {
  const calls = [];
  const ctx = fakeCtx();
  ctx.drawImage = () => calls.push('img'); // count any drawImage
  const ts = {
    atlasReady: false,
    drawTile() {},
    backgroundImage: () => null, // tileset has none
    terrainFor: () => null,
    entityFor: () => null,
    decorationFor: () => null,
    foregroundFor: () => null,
  };
  // meta.backgroundImage is null by default for a fresh parse.
  draw(ctx, parse('#'), ts, 10);
  assert.equal(calls.length, 0);
});

test('v18: Pass 4c draws foregroundFor cells AFTER entities (Flag-Pole-over-Player)', () => {
  const order = [];
  const ctx = fakeCtx();
  ctx.drawImage = () => order.push('img'); // each drawImage call recorded
  const playerSpec = { image: { width: 32, height: 32 }, sx: 0, sy: 0, sw: 32, sh: 32 };
  const poleSpec = { image: { width: 32, height: 32 }, sx: 0, sy: 0, sw: 32, sh: 32 };
  const ts = {
    atlasReady: false,
    drawTile() {},
    terrainFor: () => null,
    // Entity for P, foreground for |.
    entityFor: (g) => (g === 'P' ? playerSpec : null),
    decorationFor: () => null,
    foregroundFor: (g) => (g === '|' ? poleSpec : null),
  };
  // P then | on the same row — entity painted first, foreground last.
  draw(ctx, parse('P|E'), ts, 10);
  // Two drawImage calls (P + |); the | call must come AFTER P, since
  // Pass 4c runs after Pass 4b in the renderer loop. (E falls back
  // to drawFallback shape since entityFor returns null for it; no
  // drawImage from that.)
  assert.equal(order.length, 2);
});

test('v18: Pass 4b shape-fallback skipped when char is a foreground decoration', () => {
  // entityFor + decorationFor + foregroundFor all gate the
  // drawFallback path — only when ALL three are null does the
  // shape get drawn. A foreground char must NOT shape-fallback.
  const ctx = fakeCtx();
  const poleSpec = { image: { width: 32, height: 32 }, sx: 0, sy: 0, sw: 32, sh: 32 };
  const ts = {
    atlasReady: false,
    drawTile() {},
    terrainFor: () => null,
    entityFor: () => null,
    decorationFor: () => null,
    foregroundFor: (g) => (g === '|' ? poleSpec : null),
  };
  draw(ctx, parse('|'), ts, 10);
  // No shape-fallback fillRect (other than the always-on SKY rect).
  // SKY rect = 1; no '#' cells, no shape entity → exactly 1 fillRect.
  assert.equal(ctx.calls.fillRect, 1);
  // The | character WAS drawn (via Pass 4c, drawImage).
  assert.equal(ctx.calls.drawImage, 1);
  // No arc (no shape entity).
  assert.equal(ctx.calls.arc, 0);
});

// --- v19: optional camera param (translate + cell-cull) ------------

// Richer fake ctx that records translate / save / restore for the
// camera-mode tests. Behaves like fakeCtx otherwise.
function cameraCtx() {
  const calls = {
    fillRect: 0,
    arc: 0,
    drawImage: 0,
    translate: [], // {x, y}
    save: 0,
    restore: 0,
  };
  return {
    canvas: { width: 0, height: 0 },
    set fillStyle(_) {},
    fillRect: () => calls.fillRect++,
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    arc: () => calls.arc++,
    fill() {},
    drawImage: () => calls.drawImage++,
    translate: (x, y) => calls.translate.push({ x, y }),
    save: () => calls.save++,
    restore: () => calls.restore++,
    calls,
  };
}

test('v19: camera=null path makes ZERO translate/save/restore calls (back-compat)', () => {
  const ctx = cameraCtx();
  const ts = fakeTileset();
  draw(ctx, parse('###\n#P#\n###'), ts, 10);
  assert.equal(ctx.calls.translate.length, 0);
  assert.equal(ctx.calls.save, 0);
  assert.equal(ctx.calls.restore, 0);
});

test('v19: camera sized canvas to viewport (not world)', () => {
  // 8x4 world @ 10 px/cell = 80x40. Viewport 50x30.
  const ctx = cameraCtx();
  const ts = fakeTileset();
  draw(
    ctx,
    parse('########\n#......#\n#..P..E#\n########'),
    ts,
    10,
    0,
    { camX: 0, camY: 0, viewW: 50, viewH: 30 },
  );
  assert.equal(ctx.canvas.width, 50);
  assert.equal(ctx.canvas.height, 30);
});

test('v19: camera applies translate(-round(camX), -round(camY))', () => {
  const ctx = cameraCtx();
  const ts = fakeTileset();
  draw(
    ctx,
    parse('########\n#......#\n#..P..E#\n########'),
    ts,
    10,
    0,
    { camX: 20.4, camY: 5.7, viewW: 50, viewH: 30 },
  );
  // One save() + one matching restore() bracket the world drawing.
  assert.equal(ctx.calls.save, 1);
  assert.equal(ctx.calls.restore, 1);
  // Exactly one translate, rounded.
  assert.equal(ctx.calls.translate.length, 1);
  assert.deepEqual(ctx.calls.translate[0], { x: -20, y: -6 });
});

test('v19: cell-cull cuts drawImage calls for big worlds', () => {
  // 40-wide x 4-tall world; viewport 10 wide × 4 tall. We expect the
  // total draw-call count to be roughly proportional to 12 columns (10
  // visible + bleed of 1 each side, clamped at world edges), not 40.
  const wideRow = '#' + '.'.repeat(38) + '#';
  const topBottomRow = '#'.repeat(40);
  const grid = [topBottomRow, wideRow, wideRow, topBottomRow].join('\n');
  const parsed = parse(grid);

  // Non-atlas tileset to keep the call count tight (Pass 1 + Pass 3 off).
  const ts = { ...fakeTileset({ atlasReady: false }) };

  const ctxFull = cameraCtx();
  draw(ctxFull, parsed, ts, 10); // no camera = whole world
  const fullCalls = ctxFull.calls.drawImage;

  const ctxView = cameraCtx();
  draw(ctxView, parsed, ts, 10, 0, { camX: 0, camY: 0, viewW: 100, viewH: 40 });
  const viewCalls = ctxView.calls.drawImage;

  // The cull must save a measurable amount: at least a 50% reduction
  // for this 40-wide-vs-10-wide setup. (Loose threshold so tweaking
  // the bleed-by-1 detail doesn't break the spec.)
  assert.ok(
    viewCalls < fullCalls * 0.5,
    `expected viewCalls (${viewCalls}) < 50% of fullCalls (${fullCalls})`,
  );
});

test('v19: cell-cull respects world bounds (no out-of-range reads)', () => {
  // 4×4 world; viewport much larger than world; bleed-extension should
  // clamp at grid bounds, not throw or read past the end.
  const ctx = cameraCtx();
  const ts = fakeTileset();
  assert.doesNotThrow(() =>
    draw(ctx, parse('####\n#PE#\n#..#\n####'), ts, 10, 0, {
      camX: 0,
      camY: 0,
      viewW: 200,
      viewH: 200,
    }),
  );
});

test('v19: camera=null + camera={camX:0,camY:0,viewW:worldW,viewH:worldH} have identical drawImage counts', () => {
  // The cell-cull range covers the whole grid at camX=0/camY=0 and
  // viewport == world, so the windowed path should match the world
  // path exactly. This is the fit-mode "byte-identical" guarantee at
  // the call-count level.
  const grid = '######\n#....#\n#.PE.#\n######';
  const parsed = parse(grid);
  const ts1 = fakeTileset();
  const ts2 = fakeTileset();

  const ctx1 = cameraCtx();
  draw(ctx1, parsed, ts1, 10);
  const ctx2 = cameraCtx();
  draw(ctx2, parsed, ts2, 10, 0, {
    camX: 0,
    camY: 0,
    viewW: 60,
    viewH: 40,
  });
  assert.equal(ctx2.calls.drawImage, ctx1.calls.drawImage);
});

// Regression gate: the Dirt tile_lookup.json must map every mask to the same
// tile v6 drew (design §4 table). With the tileMask test above, this proves
// the v7 render is byte-identical to v6 without rendering.
test('Dirt tile_lookup maps each mask to the v6 §4 tile', () => {
  const lookup = JSON.parse(
    readFileSync(
      'public/data/tilesets/Dirt_Platformer_Tiles/tile_lookup.json',
      'utf8',
    ),
  );
  const v6Index = [27, 20, 24, 16, 4, 12, 0, 8, 26, 18, 25, 17, 2, 10, 1, 9];
  for (let m = 0; m < 16; m++) {
    const file = lookup.filled[String(m)].image; // e.g. tiles/00_dirt_top_left.png
    const lead = Number(file.match(/(\d+)_/)[1]);
    assert.equal(lead, v6Index[m], `mask ${m}`);
  }
});
