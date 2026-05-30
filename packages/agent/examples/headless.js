// Standalone smoke for @2d-platform/agent.
//
//   node packages/agent/examples/headless.js
//
// Demonstrates that the agent's ONLY engine coupling is the physics
// adapter: this file constructs a minimal STUB adapter (a toy flat-
// world walk model — no real gravity, no collision) with zero
// dependency on the editor's src/play/* engine, hand-builds a parsed
// level, and runs plan(). A non-empty trace proves the agent planned
// purely against the injected adapter.

import { plan } from '../src/index.js';

const TILE = 20;

// --- stub ScriptedInput ------------------------------------------------
// Minimal { advance, isDown, wasPressed, endFrame } over a recording of
// { frame, key, down } events.
function makeStubInput(recording = []) {
  const held = new Set();
  let applied = -1;
  return {
    advance(frame) {
      // Idempotent: re-advancing to an already-applied frame is a no-op
      // (matches the real ScriptedInput; the agent re-advances).
      for (let f = applied + 1; f <= frame; f++) {
        for (const ev of recording) {
          if (ev.frame !== f) continue;
          if (ev.down) held.add(ev.key);
          else held.delete(ev.key);
        }
      }
      if (frame > applied) applied = frame;
    },
    isDown: (k) => held.has(k),
    wasPressed: () => false,
    endFrame() {},
  };
}

// --- stub scene --------------------------------------------------------
// A flat world: the player only moves horizontally at walk speed; it is
// always grounded; touching the exit cell wins. Enough surface for the
// agent's walk edges to chain to the exit.
function makeStubScene(parsed) {
  const exitCells = [];
  for (let r = 0; r < parsed.grid.length; r++) {
    for (let c = 0; c < parsed.grid[r].length; c++) {
      if (parsed.grid[r][c] === 'E') exitCells.push({ r, c });
    }
  }
  const scene = {
    game: { input: makeStubInput([]), assets: { play() {} } },
    player: { x: 0, y: 0, w: TILE, h: TILE, vx: 0, vy: 0, onGround: true },
    coins: [],
    phase: 'play',
    score: 0,
    simFrame: 0,
    simTime: 0,
    enter() { this.phase = 'play'; },
    setPlayerState({ x, y, vx = 0, vy = 0, onGround = true }) {
      Object.assign(this.player, { x, y, vx, vy, onGround });
    },
    update(dt) {
      const input = this.game.input;
      let vx = 0;
      if (input?.isDown('right')) vx = 240;
      else if (input?.isDown('left')) vx = -240;
      this.player.vx = vx;
      this.player.vy = 0;
      this.player.onGround = true;
      this.player.x += vx * dt;
      // Win on AABB overlap with any exit cell.
      for (const e of exitCells) {
        const bx = e.c * TILE;
        const by = e.r * TILE;
        if (this.player.x < bx + TILE && this.player.x + TILE > bx &&
            this.player.y < by + TILE && this.player.y + TILE > by) {
          this.phase = 'won';
        }
      }
    },
  };
  return scene;
}

const stubAdapter = {
  TILE,
  makeScene(parsed) {
    const s = makeStubScene(parsed);
    s.enter();
    return s;
  },
  makeScriptedInput(recording) {
    return makeStubInput(recording);
  },
};

// --- run ---------------------------------------------------------------
// A flat corridor: P at col 1, exit at col 6, solid floor below.
const parsed = {
  grid: [
    '########',
    '#P....E#',
    '########',
  ],
  meta: { width: 8, pickupRequired: 0 },
};

const result = plan(parsed, {}, { adapter: stubAdapter });

console.log('plan() via STUB adapter:');
console.log('  trace steps :', result.trace.length);
console.log('  recording   :', result.recording.length, 'events');
console.log('  goals       :', result.goals.join(' → '));

if (result.trace.length === 0) {
  console.error('FAIL: empty trace — the agent did not plan against the stub.');
  process.exit(1);
}
console.log('OK: agent planned in isolation (no src/play/* engine).');
