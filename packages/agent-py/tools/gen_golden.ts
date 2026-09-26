// Golden-vector generator for the Python adapter's parity tests.
//
//   deno task gen:golden
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
//   - agent     : the JS agent's own Planner.plan() recording on a real level —
//                 long, multi-feature, the strongest parity signal.

import { jsAdapter } from '@2d-platform/engine';
import { Legend, Level } from '@2d-platform/level-format';
import { PlannerFactory } from '@2d-platform/agent';
import type { LevelData, LevelMeta, PickupRequired, Role } from '@2d-platform/level-format';
import type { RecordingEvent } from '@2d-platform/engine';
import type { GamePhase } from '@2d-platform/engine';

// One captured engine frame: the player's full state after update(dt).
interface GoldenFrame {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  phase: GamePhase;
  score: number;
}

// The meta subset the Python side reads.
interface GoldenMeta {
  width: number;
  height: number;
  pickupRequired: PickupRequired;
}

interface GoldenCase {
  name: string;
  kind: 'primitive' | 'agent';
  grid: readonly string[];
  meta: GoldenMeta;
  recording: readonly RecordingEvent[];
  maxFrames: number;
  frames: GoldenFrame[];
}

interface PrimitiveCase {
  name: string;
  level: string;
  recording: RecordingEvent[];
  maxFrames: number;
}

// Always set for a local file module (only remote modules lack it).
const HERE = import.meta.dirname!;
const REPO = `${HERE}/../../..`;
const DT = 1 / 60;

// Drive the JS engine exactly as the agent's Simulator does — advance(f) then
// update(dt) — capturing the full player state each frame. Stops on a
// terminal phase so the vectors don't trail dead air.
function drive(parsed: LevelData, recording: readonly RecordingEvent[], maxFrames: number): GoldenFrame[] {
  const input = jsAdapter.makeScriptedInput(recording);
  const scene = jsAdapter.makeScene(parsed, Legend.DEFAULT.toRecord(), null);
  scene.game.input = input;
  const frames: GoldenFrame[] = [];
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

const trimMeta = (m: LevelMeta): GoldenMeta => ({
  width: m.width,
  height: m.height,
  pickupRequired: m.pickupRequired ?? 'all',
});

// --- primitive cases (explicit recordings) -----------------------------
const PRIMITIVES: PrimitiveCase[] = [
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
// below_ground.txt is the chained-jump level the v28 per-frame planner
// was built to solve — the strongest exercise of the planner port.
const AGENT_LEVELS = ['tutorial.txt', 'simple.txt', 'above_ground.txt', 'below_ground.txt'];

const cases: GoldenCase[] = [];

for (const c of PRIMITIVES) {
  const parsed = Level.parse(c.level);
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

// The default (per-frame) planner, as the editor's Test button uses.
const planner = PlannerFactory.create(jsAdapter);
for (const file of AGENT_LEVELS) {
  const text = Deno.readTextFileSync(`${REPO}/content/data/levels/${file}`);
  const parsed = Level.parse(text);
  const p = planner.plan(parsed, Legend.DEFAULT.toRecord());
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
const roles: Record<string, Role> = {};
for (const [ch, entry] of Legend.DEFAULT) roles[ch] = entry.role;

const out = { generatedFrom: 'jsAdapter (src/agent-adapter.js)', dt: DT, roles, cases };

const outDir = `${HERE}/../tests/golden`;
Deno.mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}/vectors.json`;
Deno.writeTextFileSync(outPath, JSON.stringify(out, null, 2) + '\n');

console.log(`Wrote ${cases.length} cases to ${outPath}`);
for (const c of cases) {
  const last = c.frames[c.frames.length - 1];
  console.log(`  ${c.name.padEnd(28)} ${c.frames.length} frames → ${last.phase} (score ${last.score})`);
}
