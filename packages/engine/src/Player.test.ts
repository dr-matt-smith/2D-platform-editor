import { assert, assertEquals } from '@std/assert';
import { GRAVITY, JUMP_FORCE, SPEED, TILE } from './constants.ts';
import { Key } from './Key.ts';
import { Platform } from './Platform.ts';
import { PlatformKind } from './PlatformKind.ts';
import { Player } from './Player.ts';
import { ScriptedInput } from './ScriptedInput.ts';
import type { RecordingEvent } from './RecordingEvent.ts';

const DT = 1 / 60;
// A floor whose top is at y = 40, under a player standing at y = 20.
const FLOOR = [new Platform(0, 40, 200, TILE, PlatformKind.Ground)];

// Input with `events` applied at frame 0.
function keys(...events: RecordingEvent[]): ScriptedInput {
  const input = new ScriptedInput(events);
  input.advance(0);
  return input;
}

Deno.test('a new player is a still, airborne, tile-sized box', () => {
  const p = new Player(20, 20);
  assertEquals([p.w, p.h, p.vx, p.vy, p.onGround], [TILE, TILE, 0, 0, false]);
});

Deno.test('gravity accelerates a falling player', () => {
  const p = new Player(20, 0);
  p.update(DT, { input: keys(), solids: [] });
  assertEquals(p.vy, GRAVITY * DT);
  assertEquals(p.y, GRAVITY * DT * DT);
});

Deno.test('a falling player lands on a platform top and is grounded', () => {
  const p = new Player(20, 19.9);
  p.update(DT, { input: keys(), solids: FLOOR });
  assertEquals([p.y, p.vy, p.onGround], [20, 0, true]);
});

Deno.test('holding right runs at SPEED', () => {
  const p = new Player(20, 20);
  p.update(DT, { input: keys({ frame: 0, key: Key.Right, down: true }), solids: FLOOR });
  assertEquals(p.vx, SPEED);
  assertEquals(p.x, 20 + SPEED * DT);
});

Deno.test('jump only works from the ground', () => {
  const jump = { frame: 0, key: Key.Space, down: true };
  const airborne = new Player(20, 0);
  airborne.update(DT, { input: keys(jump), solids: [] });
  assert(airborne.vy > 0, 'no jump in mid-air');

  const grounded = new Player(20, 20);
  grounded.onGround = true;
  grounded.update(DT, { input: keys(jump), solids: FLOOR });
  assertEquals(grounded.vy, -JUMP_FORCE + GRAVITY * DT);
  assertEquals(grounded.onGround, false);
});

Deno.test('a wall stops horizontal movement', () => {
  const wall = new Platform(40, 0, TILE, 80, PlatformKind.Ground);
  const p = new Player(19, 20);
  p.update(DT, { input: keys({ frame: 0, key: Key.Right, down: true }), solids: [wall] });
  assertEquals(p.x, 20); // pushed back to the wall's left face
});

Deno.test('setState forces a pose; velocity and ground default to a standing start', () => {
  const p = new Player(0, 0);
  p.setState({ x: 5, y: 6, vx: 7, vy: 8, onGround: true });
  assertEquals([p.x, p.y, p.vx, p.vy, p.onGround], [5, 6, 7, 8, true]);
  p.setState({ x: 1, y: 2 });
  assertEquals([p.x, p.y, p.vx, p.vy, p.onGround], [1, 2, 0, 0, false]);
});

Deno.test('Entity helpers: bounds is a copy, centre is the middle of the box', () => {
  const p = new Player(20, 40);
  const b = p.bounds;
  b.x = 999;
  assertEquals(p.x, 20);
  assertEquals(p.centre, { x: 30, y: 50 });
  assert(p.overlaps({ x: 35, y: 45, w: 10, h: 10 }));
});
