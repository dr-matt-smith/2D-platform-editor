// Standalone smoke for @2d-platform/agent.
//
//   deno run -A packages/agent/examples/headless.ts
//
// Demonstrates that the agent's ONLY engine coupling is the physics
// adapter: this file implements PhysicsAdapter with a minimal STUB (a toy
// flat-world walk model — no real gravity, no collision) and no
// dependency on the engine package, hand-builds a parsed level, and asks
// a Planner for a plan. A non-empty trace proves the agent planned purely
// against the injected adapter.

import { PlannerFactory } from '../src/index.ts';
import type {
  Cell,
  ParsedLevel,
  PhysicsAdapter,
  PlayerState,
  Recording,
  SceneHandle,
  ScenePhase,
  ScriptedInputHandle,
} from '../src/index.ts';

const TILE = 20;

// --- stub scripted input ----------------------------------------------
// Minimal { advance, isDown, wasPressed, endFrame } over a recording of
// { frame, key, down } events.
function makeStubInput(recording: Recording = []): ScriptedInputHandle {
  const held = new Set<string>();
  let applied = -1;
  return {
    advance(frame: number) {
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
    isDown: (k: string) => held.has(k),
    wasPressed: () => false,
    endFrame() {},
  };
}

// --- stub scene --------------------------------------------------------
// A flat world: the player only moves horizontally at walk speed; it is
// always grounded; touching the exit cell wins. Enough for the planner's
// walk edges to chain to the exit.
function makeStubScene(parsed: ParsedLevel): SceneHandle {
  const exitCells: Cell[] = [];
  for (let r = 0; r < parsed.grid.length; r++) {
    for (let c = 0; c < parsed.grid[r].length; c++) {
      if (parsed.grid[r][c] === 'E') exitCells.push({ r, c });
    }
  }
  const scene = {
    game: { input: makeStubInput([]), assets: { play() {} } },
    player: { x: 0, y: 0, w: TILE, h: TILE, vx: 0, vy: 0, onGround: true },
    coins: [],
    phase: 'play' as ScenePhase,
    score: 0,
    simFrame: 0,
    simTime: 0,
    enter() { this.phase = 'play'; },
    setPlayerState({ x, y, vx = 0, vy = 0, onGround = true }: PlayerState) {
      Object.assign(this.player, { x, y, vx, vy, onGround });
    },
    update(dt: number) {
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

const stubAdapter: PhysicsAdapter = {
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
// A flat corridor: P at col 1, exit at col 6, solid floor below. The
// legend is null, so the classic glyphs (P, E, #) give the roles.
const parsed = {
  grid: [
    '########',
    '#P....E#',
    '########',
  ],
  meta: { width: 8, pickupRequired: 0 },
};

const result = PlannerFactory.create(stubAdapter).plan(parsed, null);

console.log('Planner.plan() via STUB adapter:');
console.log('  trace steps :', result.trace.length);
console.log('  recording   :', result.recording.length, 'events');
console.log('  goals       :', result.goals.join(' → '));

if (result.trace.length === 0) {
  console.error('FAIL: empty trace — the agent did not plan against the stub.');
  Deno.exit(1);
}
console.log('OK: agent planned in isolation (no engine package).');
