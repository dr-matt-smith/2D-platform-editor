import { assert, assertEquals } from '@std/assert';
import { parse } from '../level.ts';
import type { RoleLegend } from '../level.ts';
import { toWorld } from './adapter.ts';

// 5x4: border walls, one spawn, two pickups, one spike, one exit.
const TEXT = ['# size: 5x4', '#####', '#Po.#', '#.^E#', '#####'].join('\n');

Deno.test('maps glyphs to the right entity kinds and counts', () => {
  const w = toWorld(parse(TEXT), undefined, 20);
  assert(w.player, 'player built from P');
  assertEquals(w.coins.length, 1); // single 'o'
  assertEquals(w.spikes.length, 1); // single '^'
  assertEquals(w.goals.length, 1); // single 'E'
  // border + interior walls: row0 5 + row3 5 + (#..#)x2 col walls = 14
  assertEquals(w.platforms.length, 14);
});

Deno.test('positions are cell*tile; world size is dims*tile', () => {
  const w = toWorld(parse(TEXT), undefined, 20);
  assertEquals({ x: w.player!.x, y: w.player!.y }, { x: 20, y: 20 }); // (1,1)
  assertEquals(w.coins[0].x, 40); // col 2
  assertEquals(w.coins[0].y, 20); // row 1
  assertEquals(w.worldW, 5 * 20);
  assertEquals(w.worldH, 4 * 20);
});

Deno.test('tile size is configurable and scales coordinates', () => {
  const w = toWorld(parse(TEXT), undefined, 32);
  assertEquals(w.player!.x, 32);
  assertEquals(w.worldW, 5 * 32);
});

Deno.test('background and unknown glyphs are ignored, never thrown', () => {
  // 'Z' is not in the alphabet; '.' and ' ' are background.
  const w = toWorld(parse('P.Z\n.  '));
  assert(w.player);
  assertEquals(w.platforms.length, 0);
  assertEquals(w.coins.length, 0);
  assertEquals(w.goals.length, 0);
});

Deno.test('a level with no pickups yields an empty coins array', () => {
  const w = toWorld(parse('PE'));
  assertEquals(w.coins, []);
  assertEquals(w.goals.length, 1);
});

// --- v11 role-driven mapping ----------------------------------------

Deno.test('v11: multi-char pickup glyphs are all collected as coins', () => {
  // A tileset with three pickup chars (apple/cherry/banana).
  const legend: RoleLegend = {
    '.': { role: 'background' },
    P:   { role: 'player' },
    E:   { role: 'exit' },
    o:   { role: 'pickup' },
    O:   { role: 'pickup' },
    '&': { role: 'pickup' },
  };
  const w = toWorld(parse('PoO&E'), legend);
  assertEquals(w.coins.length, 3);
  assertEquals(w.goals.length, 1);
  assert(w.player);
});

Deno.test('v11: multi-char hazard glyphs are all built as spikes', () => {
  const legend: RoleLegend = {
    '.': { role: 'background' },
    P:   { role: 'player' },
    E:   { role: 'exit' },
    '^': { role: 'hazard' },
    '*': { role: 'hazard' },
  };
  const w = toWorld(parse('P^*E'), legend);
  assertEquals(w.spikes.length, 2);
});

Deno.test('v11: decoration glyphs are ignored — no entity, no collision', () => {
  const legend: RoleLegend = {
    '.': { role: 'background' },
    '#': { role: 'terrain' },
    P:   { role: 'player' },
    E:   { role: 'exit' },
    T:   { role: 'decoration' },
    b:   { role: 'decoration' },
  };
  const w = toWorld(parse('PTbE'), legend);
  // Three non-background cells, but only player + goal become entities.
  assert(w.player);
  assertEquals(w.goals.length, 1);
  assertEquals(w.platforms.length, 0);
  assertEquals(w.spikes.length, 0);
  assertEquals(w.coins.length, 0);
});

Deno.test('v11: a tileset rebinding the spawn char ("@") still produces a player', () => {
  const legend: RoleLegend = {
    '.': { role: 'background' },
    '@': { role: 'player' },
    E:   { role: 'exit' },
  };
  const w = toWorld(parse('@.E'), legend);
  assert(w.player);
  assertEquals(w.player!.x, 0);
});

Deno.test('v11: unknown chars (not in legend) are silently ignored', () => {
  const legend: RoleLegend = { '.': { role: 'background' }, P: { role: 'player' }, E: { role: 'exit' } };
  // 'Z' is not in legend — falls through to default → ignored.
  const w = toWorld(parse('PZE'), legend);
  assert(w.player);
  assertEquals(w.spikes.length, 0);
  assertEquals(w.coins.length, 0);
});
