import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../level.js';
import { toWorld } from './adapter.js';

// 5x4: border walls, one spawn, two pickups, one spike, one exit.
const TEXT = ['# size: 5x4', '#####', '#Po.#', '#.^E#', '#####'].join('\n');

test('maps glyphs to the right entity kinds and counts', () => {
  const w = toWorld(parse(TEXT), undefined, 20);
  assert.ok(w.player, 'player built from P');
  assert.equal(w.coins.length, 1); // single 'o'
  assert.equal(w.spikes.length, 1); // single '^'
  assert.equal(w.goals.length, 1); // single 'E'
  // border + interior walls: row0 5 + row3 5 + (#..#)x2 col walls = 14
  assert.equal(w.platforms.length, 14);
});

test('positions are cell*tile; world size is dims*tile', () => {
  const w = toWorld(parse(TEXT), undefined, 20);
  assert.deepEqual({ x: w.player.x, y: w.player.y }, { x: 20, y: 20 }); // (1,1)
  assert.equal(w.coins[0].x, 40); // col 2
  assert.equal(w.coins[0].y, 20); // row 1
  assert.equal(w.worldW, 5 * 20);
  assert.equal(w.worldH, 4 * 20);
});

test('tile size is configurable and scales coordinates', () => {
  const w = toWorld(parse(TEXT), undefined, 32);
  assert.equal(w.player.x, 32);
  assert.equal(w.worldW, 5 * 32);
});

test('background and unknown glyphs are ignored, never thrown', () => {
  // 'Z' is not in the alphabet; '.' and ' ' are background.
  const w = toWorld(parse('P.Z\n.  '));
  assert.ok(w.player);
  assert.equal(w.platforms.length, 0);
  assert.equal(w.coins.length, 0);
  assert.equal(w.goals.length, 0);
});

test('a level with no pickups yields an empty coins array', () => {
  const w = toWorld(parse('PE'));
  assert.deepEqual(w.coins, []);
  assert.equal(w.goals.length, 1);
});

// --- v11 role-driven mapping ----------------------------------------

test('v11: multi-char pickup glyphs are all collected as coins', () => {
  // A tileset with three pickup chars (apple/cherry/banana).
  const legend = {
    '.': { role: 'background' },
    P:   { role: 'player' },
    E:   { role: 'exit' },
    o:   { role: 'pickup' },
    O:   { role: 'pickup' },
    '&': { role: 'pickup' },
  };
  const w = toWorld(parse('PoO&E'), legend);
  assert.equal(w.coins.length, 3);
  assert.equal(w.goals.length, 1);
  assert.ok(w.player);
});

test('v11: multi-char hazard glyphs are all built as spikes', () => {
  const legend = {
    '.': { role: 'background' },
    P:   { role: 'player' },
    E:   { role: 'exit' },
    '^': { role: 'hazard' },
    '*': { role: 'hazard' },
  };
  const w = toWorld(parse('P^*E'), legend);
  assert.equal(w.spikes.length, 2);
});

test('v11: decoration glyphs are ignored — no entity, no collision', () => {
  const legend = {
    '.': { role: 'background' },
    '#': { role: 'terrain' },
    P:   { role: 'player' },
    E:   { role: 'exit' },
    T:   { role: 'decoration' },
    b:   { role: 'decoration' },
  };
  const w = toWorld(parse('PTbE'), legend);
  // Three non-background cells, but only player + goal become entities.
  assert.ok(w.player);
  assert.equal(w.goals.length, 1);
  assert.equal(w.platforms.length, 0);
  assert.equal(w.spikes.length, 0);
  assert.equal(w.coins.length, 0);
});

test('v11: a tileset rebinding the spawn char ("@") still produces a player', () => {
  const legend = {
    '.': { role: 'background' },
    '@': { role: 'player' },
    E:   { role: 'exit' },
  };
  const w = toWorld(parse('@.E'), legend);
  assert.ok(w.player);
  assert.equal(w.player.x, 0);
});

test('v11: unknown chars (not in legend) are silently ignored', () => {
  const legend = { '.': { role: 'background' }, P: { role: 'player' }, E: { role: 'exit' } };
  // 'Z' is not in legend — falls through to default → ignored.
  const w = toWorld(parse('PZE'), legend);
  assert.ok(w.player);
  assert.equal(w.spikes.length, 0);
  assert.equal(w.coins.length, 0);
});
