import { assert, assertEquals } from '@std/assert';
import { Legend, Level, Role } from '@2d-platform/level-format';
import { Entity } from './Entity.ts';
import { Platform } from './Platform.ts';
import { PlatformKind } from './PlatformKind.ts';
import { Player } from './Player.ts';
import { World } from './World.ts';

// 5x4: border walls, one spawn, two pickups, one spike, one exit.
const TEXT = ['# size: 5x4', '#####', '#Po.#', '#.^E#', '#####'].join('\n');

Deno.test('maps glyphs to the right entity kinds and counts', () => {
  const w = World.fromLevel(Level.parse(TEXT), undefined, 20);
  assert(w.player, 'player built from P');
  assertEquals(w.coins.length, 1); // single 'o'
  assertEquals(w.spikes.length, 1); // single '^'
  assertEquals(w.goals.length, 1); // single 'E'
  // border + interior walls: row0 5 + row3 5 + (#..#)x2 col walls = 14
  assertEquals(w.platforms.length, 14);
});

Deno.test('positions are cell*tile; world size is dims*tile', () => {
  const w = World.fromLevel(Level.parse(TEXT), undefined, 20);
  assertEquals({ x: w.player!.x, y: w.player!.y }, { x: 20, y: 20 }); // (1,1)
  assertEquals(w.coins[0].x, 40); // col 2
  assertEquals(w.coins[0].y, 20); // row 1
  assertEquals(w.width, 5 * 20);
  assertEquals(w.height, 4 * 20);
});

Deno.test('tile size is configurable and scales coordinates', () => {
  const w = World.fromLevel(Level.parse(TEXT), undefined, 32);
  assertEquals(w.player!.x, 32);
  assertEquals(w.width, 5 * 32);
});

Deno.test('background and unknown glyphs are ignored, never thrown', () => {
  // 'Z' is not in the alphabet; '.' and ' ' are background.
  const w = World.fromLevel(Level.parse('P.Z\n.  '));
  assert(w.player);
  assertEquals(w.platforms.length, 0);
  assertEquals(w.coins.length, 0);
  assertEquals(w.goals.length, 0);
});

Deno.test('a level with no pickups yields an empty coins array', () => {
  const w = World.fromLevel(Level.parse('PE'));
  assertEquals(w.coins, []);
  assertEquals(w.goals.length, 1);
});

// --- v11 role-driven mapping ----------------------------------------

Deno.test('v11: multi-char pickup glyphs are all collected as coins', () => {
  // A tileset with three pickup chars (apple/cherry/banana).
  const legend = Legend.fromRecord({
    '.': { role: Role.Background },
    P:   { role: Role.Player },
    E:   { role: Role.Exit },
    o:   { role: Role.Pickup },
    O:   { role: Role.Pickup },
    '&': { role: Role.Pickup },
  });
  const w = World.fromLevel(Level.parse('PoO&E'), legend);
  assertEquals(w.coins.length, 3);
  assertEquals(w.goals.length, 1);
  assert(w.player);
});

Deno.test('v11: multi-char hazard glyphs are all built as spikes', () => {
  const legend = Legend.fromRecord({
    '.': { role: Role.Background },
    P:   { role: Role.Player },
    E:   { role: Role.Exit },
    '^': { role: Role.Hazard },
    '*': { role: Role.Hazard },
  });
  const w = World.fromLevel(Level.parse('P^*E'), legend);
  assertEquals(w.spikes.length, 2);
});

Deno.test('v11: decoration glyphs are ignored — no entity, no collision', () => {
  const legend = Legend.fromRecord({
    '.': { role: Role.Background },
    '#': { role: Role.Terrain },
    P:   { role: Role.Player },
    E:   { role: Role.Exit },
    T:   { role: Role.Decoration },
    b:   { role: Role.Decoration },
  });
  const w = World.fromLevel(Level.parse('PTbE'), legend);
  // Three non-background cells, but only player + goal become entities.
  assert(w.player);
  assertEquals(w.goals.length, 1);
  assertEquals(w.platforms.length, 0);
  assertEquals(w.spikes.length, 0);
  assertEquals(w.coins.length, 0);
});

Deno.test('v11: a tileset rebinding the spawn char ("@") still produces a player', () => {
  const legend = Legend.fromRecord({
    '.': { role: Role.Background },
    '@': { role: Role.Player },
    E:   { role: Role.Exit },
  });
  const w = World.fromLevel(Level.parse('@.E'), legend);
  assert(w.player);
  assertEquals(w.player!.x, 0);
});

Deno.test('v11: unknown chars (not in legend) are silently ignored', () => {
  const legend = Legend.fromRecord({ '.': { role: Role.Background }, P: { role: Role.Player }, E: { role: Role.Exit } });
  // 'Z' is not in legend — falls through to default → ignored.
  const w = World.fromLevel(Level.parse('PZE'), legend);
  assert(w.player);
  assertEquals(w.spikes.length, 0);
  assertEquals(w.coins.length, 0);
});

// --- the Entity hierarchy -----------------------------------------------

Deno.test('entities lists every entity, back to front, player last', () => {
  const w = World.fromLevel(Level.parse(TEXT), undefined, 20);
  const all = w.entities;
  assertEquals(all.length, 14 + 1 + 1 + 1 + 1);
  assert(all.every((e) => e instanceof Entity));
  assert(all[all.length - 1] instanceof Player);
  assert(all[0] instanceof Platform);
});

Deno.test('terrain becomes ground platforms', () => {
  const w = World.fromLevel(Level.parse(TEXT));
  assert(w.platforms.every((p) => p.kind === PlatformKind.Ground));
});

Deno.test('size is the world size as { w, h }', () => {
  const w = World.fromLevel(Level.parse(TEXT), undefined, 20);
  assertEquals(w.size, { w: 100, h: 80 });
});

Deno.test('draw asks every entity to draw itself (polymorphism)', () => {
  // A stand-in 2D context that counts the calls each kind of shape makes.
  const calls: string[] = [];
  const record = (name: string) => () => calls.push(name);
  const ctx = {
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    beginPath: record('beginPath'),
    arc: record('arc'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    fill: record('fill'),
  } as unknown as CanvasRenderingContext2D;
  const w = World.fromLevel(Level.parse('Po^E'));
  w.draw(ctx);
  // Goal: 2 fillRect + strokeRect; spike: a path; coin: an arc; player: fillRect.
  assertEquals(calls.filter((c) => c === 'arc').length, 1);
  assertEquals(calls.filter((c) => c === 'closePath').length, 1);
  assertEquals(calls.filter((c) => c === 'fillRect').length, 3);
  assertEquals(calls.filter((c) => c === 'strokeRect').length, 1);
});

Deno.test('a collected coin is not drawn', () => {
  const calls: string[] = [];
  const ctx = {
    beginPath: () => calls.push('beginPath'),
    arc: () => calls.push('arc'),
    fill: () => calls.push('fill'),
  } as unknown as CanvasRenderingContext2D;
  const coin = World.fromLevel(Level.parse('o')).coins[0];
  coin.collect();
  coin.draw(ctx);
  assertEquals(calls, []);
});
