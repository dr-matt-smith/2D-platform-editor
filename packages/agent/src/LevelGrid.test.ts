import { assert, assertEquals, assertFalse } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { GlyphRole } from './GlyphRole.ts';
import { LevelGrid } from './LevelGrid.ts';

// The agent takes legends as plain records.
const DEFAULT_LEGEND = Legend.DEFAULT.toRecord();

// A tileset may draw levels with its own glyphs; only the roles matter.
const REMAPPED = {
  '.': { role: 'background' },
  '=': { role: 'terrain' },
  '~': { role: 'hazard' },
  '@': { role: 'player' },
  X: { role: 'exit' },
  '*': { role: 'pickup' },
} as const;

// --- glyph roles come from the legend ------------------------------

Deno.test('glyphRole: legend roles win; the classic glyphs apply only without a legend', () => {
  assertEquals(LevelGrid.glyphRole(REMAPPED, '='), GlyphRole.Terrain);
  assertEquals(LevelGrid.glyphRole(REMAPPED, '@'), GlyphRole.Player);
  assertEquals(LevelGrid.glyphRole(REMAPPED, '#'), null); // not in this legend
  assertEquals(LevelGrid.glyphRole(null, '#'), GlyphRole.Terrain);
  assertEquals(LevelGrid.glyphRole(null, 'P'), GlyphRole.Player);
});

// --- settle ------------------------------------------------------

Deno.test('settle: lands on first grounded cell below the start', () => {
  const grid = new LevelGrid(Level.parse('.....\n.....\n.....\n#####'));
  assertEquals(grid.settle(0, 2), { r: 2, c: 2 }); // last walkable cell above the floor
});

Deno.test('settle: falls off the world → null', () => {
  const grid = new LevelGrid(Level.parse('.....\n.....'));
  assertEquals(grid.settle(0, 2), null);
});

// --- cell queries ------------------------------------------------

Deno.test('isWalkable / isGrounded / inBounds read roles through the legend', () => {
  const grid = new LevelGrid(Level.parse('#####\n#P^E#\n#####'), DEFAULT_LEGEND);
  assert(grid.isWalkable(1, 1));
  assertFalse(grid.isWalkable(1, 2)); // hazard
  assertFalse(grid.isWalkable(0, 0)); // terrain
  assertFalse(grid.isWalkable(-1, 0)); // off the grid
  assert(grid.isGrounded(1, 1));
  assertFalse(grid.isGrounded(2, 1)); // nothing below the bottom row
  assert(grid.inBounds(2, 4));
  assertFalse(grid.inBounds(3, 0));
  assertEquals(grid.roleAt(1, 3), GlyphRole.Exit);
  assertEquals(grid.width, 5);
  assertEquals(grid.height, 3);
});

Deno.test('findLayout: settled spawn, pickups and exits in row-major order', () => {
  const grid = new LevelGrid(Level.parse('#####\n#P.o#\n#o.E#\n#####'), DEFAULT_LEGEND);
  assertEquals(grid.findLayout(), {
    start: { r: 2, c: 1 }, // P at (1,1) falls onto the pickup row's floor
    pickupCells: [{ r: 1, c: 3 }, { r: 2, c: 1 }],
    exitCells: [{ r: 2, c: 3 }],
    width: 5,
    height: 4,
  });
});

Deno.test('findLayout: a remapped legend finds the remapped glyphs', () => {
  const layout = new LevelGrid(Level.parse('=====\n=@*X=\n====='), REMAPPED).findLayout();
  assertEquals(layout.start, { r: 1, c: 1 });
  assertEquals(layout.pickupCells, [{ r: 1, c: 2 }]);
  assertEquals(layout.exitCells, [{ r: 1, c: 3 }]);
});

Deno.test('hasPlayerGlyph: true only when some glyph has the player role', () => {
  assert(new LevelGrid(Level.parse('#P#'), DEFAULT_LEGEND).hasPlayerGlyph());
  assertFalse(new LevelGrid(Level.parse('#.E#'), DEFAULT_LEGEND).hasPlayerGlyph());
});

Deno.test('cellAt: the cell under the centre of a tile-sized box', () => {
  assertEquals(LevelGrid.cellAt({ x: 20, y: 40 }), { r: 2, c: 1 });
  assertEquals(LevelGrid.cellAt({ x: 29.9, y: 40 }), { r: 2, c: 1 });
  assertEquals(LevelGrid.cellAt({ x: 30, y: 40 }), { r: 2, c: 2 });
});

Deno.test('exitOverlapping: first overlapping exit cell, or null', () => {
  const exits = [{ r: 1, c: 5 }, { r: 1, c: 6 }];
  assertEquals(LevelGrid.exitOverlapping({ x: 105, y: 20 }, exits), { r: 1, c: 5 });
  assertEquals(LevelGrid.exitOverlapping({ x: 120, y: 20 }, exits), { r: 1, c: 6 });
  // Touching edges don't overlap (strict inequality).
  assertEquals(LevelGrid.exitOverlapping({ x: 80, y: 20 }, exits), null);
});
