// Golden-vector generator for the Python adapter's parity tests.
//
//   node packages/agent-py/tools/gen_golden.mjs
//
// Drives the REAL JS engine (via jsAdapter) over a set of cases and
// records the full per-frame player state. The Python parity test
// replays the exact same cases through the Python adapter and asserts
// frame-for-frame equality. This is the contract that lets a Python
// agent trust the Python adapter reproduces the JS physics.
//
// Two kinds of case:
//   - primitive : a hand-authored recording exercising one mechanic
//                 (walk, jump arc, head-bump, pit death, spike, coin).
//   - agent     : the JS agent's own plan() recording on a real level —
//                 long, multi-feature, the strongest parity signal.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { jsAdapter } from '../../../src/agent-adapter.js';
import { parse, DEFAULT_LEGEND } from '../../../src/level.js';
import { plan } from '../../agent/src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const DT = 1 / 60;

// Drive the JS engine exactly as sim.js does — advance(f) then
// update(dt) — capturing the full player state each frame. Stops on a
// terminal phase so the vectors don't trail dead air.
function drive(parsed, recording, maxFrames) {
  const input = jsAdapter.makeScriptedInput(recording);
  const scene = jsAdapter.makeScene(parsed, DEFAULT_LEGEND, null);
  scene.game.input = input;
  const frames = [];
  for (let f = 0; f < maxFrames; f++) {
    input.advance(f);
    scene.update(DT);
    frames.push({
      x: scene.player.x,
      y: scene.player.y,
      vx: scene.player.vx,
      vy: scene.player.vy,
      onGround: scene.player.onGround,
      phase: scene.phase,
      score: scene.score,
    });
    if (scene.phase === 'won' || scene.phase === 'dead') break;
  }
  return frames;
}

const trimMeta = (m) => ({
  width: m.width,
  height: m.height,
  pickupRequired: m.pickupRequired ?? 'all',
});

// --- primitive cases (explicit recordings) -----------------------------
const PRIMITIVES = [
  {
    name: 'walk_right_to_exit',
    level: '# pickup-required: 0\n.........\n#P.....E#\n#########',
    recording: [{ frame: 0, key: 'right', down: true }],
    maxFrames: 120,
  },
  {
    name: 'jump_arc_straight_up',
    level: '# pickup-required: 0\n.........\n.........\n#P.....E#\n#########',
    recording: [
      { frame: 0, key: 'space', down: true },
      { frame: 1, key: 'space', down: false },
    ],
    maxFrames: 90,
  },
  {
    name: 'jump_into_ceiling',
    level: '# pickup-required: 0\n#########\n#P.....E#\n#########',
    recording: [
      { frame: 0, key: 'space', down: true },
      { frame: 1, key: 'space', down: false },
    ],
    maxFrames: 40,
  },
  {
    name: 'walk_off_ledge_into_pit',
    level: '# pickup-required: 0\n..........\n.P........\n.##.......\n..........\n..........',
    recording: [{ frame: 0, key: 'right', down: true }],
    maxFrames: 90,
  },
  {
    name: 'walk_into_spike_dies',
    level: '# pickup-required: 0\n.........\n#P.^...E#\n#########',
    recording: [{ frame: 0, key: 'right', down: true }],
    maxFrames: 60,
  },
  {
    name: 'collect_coin_then_exit',
    level: '.......\n#P.o.E#\n#######',
    recording: [{ frame: 0, key: 'right', down: true }],
    maxFrames: 90,
  },
];

// --- agent cases (plan() recordings on real levels) --------------------
const AGENT_LEVELS = ['tutorial.txt', 'simple.txt', 'above_ground.txt'];

const cases = [];

for (const c of PRIMITIVES) {
  const parsed = parse(c.level);
  cases.push({
    name: c.name,
    kind: 'primitive',
    grid: parsed.grid,
    meta: trimMeta(parsed.meta),
    recording: c.recording,
    maxFrames: c.maxFrames,
    frames: drive(parsed, c.recording, c.maxFrames),
  });
}

for (const file of AGENT_LEVELS) {
  const text = readFileSync(resolve(REPO, 'public/data/levels', file), 'utf8');
  const parsed = parse(text);
  const p = plan(parsed, DEFAULT_LEGEND, { adapter: jsAdapter });
  const maxFrames = 2400;
  cases.push({
    name: `agent_plan_${file.replace('.txt', '')}`,
    kind: 'agent',
    grid: parsed.grid,
    meta: trimMeta(parsed.meta),
    recording: p.recording,
    maxFrames,
    frames: drive(parsed, p.recording, maxFrames),
  });
}

// Emit the role map the JS legend used so the Python side maps glyphs
// to entities identically (no chance of legend drift).
const roles = {};
for (const [ch, entry] of Object.entries(DEFAULT_LEGEND)) roles[ch] = entry.role;

const out = { generatedFrom: 'jsAdapter (src/agent-adapter.js)', dt: DT, roles, cases };

const outDir = resolve(HERE, '../tests/golden');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'vectors.json');
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');

console.log(`Wrote ${cases.length} cases to ${outPath}`);
for (const c of cases) {
  const last = c.frames[c.frames.length - 1];
  console.log(`  ${c.name.padEnd(28)} ${c.frames.length} frames → ${last.phase} (score ${last.score})`);
}
