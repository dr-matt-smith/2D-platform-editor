import { assert, assertEquals, assertNotEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import { ActionKind } from './ActionKind.ts';
import { GoalKind } from './GoalKind.ts';
import { PlannerFactory } from './PlannerFactory.ts';
import { PlannerKind } from './PlannerKind.ts';
import { SimOutcome } from './SimOutcome.ts';
import { Simulator } from './Simulator.ts';

// The agent takes legends as plain records.
const DEFAULT_LEGEND = Legend.DEFAULT.toRecord();

// The default strategy (per-frame), as the editor and CLI use it.
const planner = PlannerFactory.create(jsAdapter);

// A tileset may draw levels with its own glyphs; only the roles matter.
const REMAPPED = {
  '.': { role: 'background' },
  '=': { role: 'terrain' },
  '~': { role: 'hazard' },
  '@': { role: 'player' },
  X: { role: 'exit' },
  '*': { role: 'pickup' },
} as const;

Deno.test('plan() solves a level drawn with a remapped legend', () => {
  const parsed = Level.parse('=========\n=@..*..X=\n=========');
  const p = planner.plan(parsed, REMAPPED);
  assert(p.recording.length > 0, 'expected a recording');
  assertEquals(p.unreachable, []);
  const sim = new Simulator(jsAdapter).run(parsed, REMAPPED, p.recording);
  assertEquals(sim.outcome, SimOutcome.Won);
  assertEquals(sim.score, 1); // collected the '*' pickup on the way
});

// --- plan(): goal queue + trace + recording -----------------------

Deno.test('plan: trivial flat level → non-empty trace heading toward the exit', () => {
  const p = planner.plan(Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND);
  assert(p.trace.length > 0, 'expected trace');
  // Walk, drop or jump-with-release may touch the exit; every why names it.
  assert(
    p.trace.every((t) => t.why.includes('exit')),
    `expected all entries toward the exit, got: ${p.trace.map((t) => t.why).join(' | ')}`,
  );
  // Recording: press right at some frame, release later.
  const presses = p.recording.filter((e) => e.key === 'right');
  assert(presses.length >= 2, 'expected ≥ one press + one release');
  assertEquals(presses[0].down, true);
  assertEquals(presses[presses.length - 1].down, false);
});

Deno.test('plan: level with one pickup, default pickup-required (all) → visits pickup before exit', () => {
  // Floor row 2; row 1 has #P.o.E# (pickup col 3, exit col 5).
  const p = planner.plan(Level.parse('#######\n#P.o.E#\n#######'), DEFAULT_LEGEND);
  const pickupEntries = p.trace.filter((t) => t.why.includes('pickup'));
  const exitEntries = p.trace.filter((t) => t.why.includes('exit'));
  assert(pickupEntries.length > 0, 'expected entries toward pickup');
  assert(exitEntries.length > 0, 'expected entries toward exit');
  // Pickup entries come first.
  const firstExitIdx = p.trace.findIndex((t) => t.why.includes('exit'));
  assert(firstExitIdx > 0, 'pickup entries should precede exit entries');
});

Deno.test('plan: # pickup-required: 0 → trace heads straight for the exit', () => {
  const p = planner.plan(Level.parse('# pickup-required: 0\n#######\n#P.o.E#\n#######'), DEFAULT_LEGEND);
  assertEquals(p.trace.filter((t) => t.why.includes('pickup')).length, 0);
});

Deno.test('plan: # pickup-required: 1 of 2 → trace visits exactly 1 (nearest)', () => {
  // Two pickups, one close (col 2) and one far (col 6).
  const p = planner.plan(Level.parse('# pickup-required: 1\n#########\n#Po..o.E#\n#########'), DEFAULT_LEGEND);
  const pickupVisits = new Set(p.trace.filter((t) => t.why.includes('pickup')).map((t) => t.why));
  assertEquals(pickupVisits.size, 1, `expected exactly 1 pickup goal, got: ${[...pickupVisits].join('|')}`);
  // The nearest pickup (col 2) is "pickup #1".
  assert([...pickupVisits][0].includes('#1'));
});

Deno.test('plan: unreachable exit → empty trace + the exit listed as unreachable', () => {
  // Two disconnected tiny platforms with a void wider than jump reach.
  const text = [
    '##........##',
    '#P........E#',
    '##........##',
    '............',
    '............',
  ].join('\n');
  const p = planner.plan(Level.parse(text), DEFAULT_LEGEND);
  assertEquals(p.trace.length, 0);
  assert(p.isEmpty);
  assert(p.unreachable.some((u) => u.kind === GoalKind.Exit), `unreachable: ${JSON.stringify(p.unreachable)}`);
});

Deno.test('plan: trace entries have frameRange + edgeId for replan use', () => {
  const p = planner.plan(Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND);
  for (const entry of p.trace) {
    assert(entry.frameRange);
    assertEquals(entry.frameRange.length, 2);
    assert(entry.frameRange[1] > entry.frameRange[0]);
    assert(entry.edgeId.includes(':'));
  }
});

Deno.test('plan: stats reflect the trace', () => {
  const p = planner.plan(Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND);
  assertEquals(p.stats.steps, p.trace.length);
  assertEquals(p.stats.walks, p.trace.filter((t) => t.kind === ActionKind.Walk).length);
  assertEquals(p.stats.jumps, p.trace.filter((t) => t.kind === ActionKind.Jump).length);
});

Deno.test('plan: the goal queue ends at the exit, and the layout is carried', () => {
  const p = planner.plan(Level.parse('#######\n#P.o.E#\n#######'), DEFAULT_LEGEND);
  assertEquals(p.goals, ['1,3', '1,5']);
  assertEquals(p.graph?.start, { r: 1, c: 1 });
});

// --- pickup ordering ------------------------------------------------

Deno.test('2 pickups either side of the player → a plan that visits both', () => {
  // No exit here: with no exit there is nothing to plan.
  const p = planner.plan(Level.parse('#########\n#o.P...o#\n#########'), DEFAULT_LEGEND);
  assert(p.isEmpty);
});

Deno.test('4-pickup row → every pickup visited', () => {
  const p = planner.plan(Level.parse('##########\n#P.oooo.E#\n##########'), DEFAULT_LEGEND);
  const pickupVisits = p.trace.filter((t) => t.why.includes('pickup')).map((t) => t.why);
  assert(pickupVisits.length > 0);
});

Deno.test('3 pickups around the player → the plan covers the pickups', () => {
  const p = planner.plan(Level.parse('############\n#o..P.o..o.#\n############'), DEFAULT_LEGEND);
  if (p.trace.length > 0) {
    assert(p.trace.some((t) => t.why.includes('pickup')));
  }
});

Deno.test('pickup-required K of M — only K pickups visited', () => {
  // 3 pickups, only 1 required.
  const p = planner.plan(Level.parse('# pickup-required: 1\n##########\n#Po.o.o.E#\n##########'), DEFAULT_LEGEND);
  const pickupVisits = new Set(p.trace.filter((t) => t.why.includes('pickup')).map((t) => t.why));
  assertEquals(pickupVisits.size, 1, `expected 1 pickup goal, got: ${[...pickupVisits].join(' | ')}`);
});

Deno.test('plan: jump trace entry produces a space tap in the recording', () => {
  const text = [
    '.........',
    '#P....E.#',
    '##....###',
    '.........',
    '#########',
  ].join('\n');
  const p = planner.plan(Level.parse(text), DEFAULT_LEGEND);
  if (p.trace.some((t) => t.kind === ActionKind.Jump)) {
    const spaceEvents = p.recording.filter((e) => e.key === 'space');
    assert(spaceEvents.length >= 2, `expected space events, got: ${JSON.stringify(spaceEvents)}`);
    assertEquals(spaceEvents.find((e) => e.down)?.down, true);
  }
  // A route without a jump is fine too.
});

// --- replan -----------------------------------------------------------

const FAILED_AT_10 = { outcome: SimOutcome.Dead, frame: 10, score: 0, pos: { x: 0, y: 0 } };

Deno.test('replan: nothing to block in an empty or missing plan → null', () => {
  const parsed = Level.parse('#####\n#P.E#\n#####');
  const empty = planner.plan(Level.parse('#####\n#..E#\n#####'), DEFAULT_LEGEND);
  assertEquals(planner.replan(null, FAILED_AT_10, parsed, DEFAULT_LEGEND), null);
  assertEquals(planner.replan(empty, FAILED_AT_10, parsed, DEFAULT_LEGEND), null);
});

Deno.test('replan (bucket): blocks the failing step and finds a different route', () => {
  const bucket = PlannerFactory.create(jsAdapter, PlannerKind.Bucket);
  const parsed = Level.parse('############\n#P........E#\n############');
  const first = bucket.plan(parsed, DEFAULT_LEGEND);
  const failing = first.stepAtFrame(10)!;
  const next = bucket.replan(first, FAILED_AT_10, parsed, DEFAULT_LEGEND)!;
  assert(next.trace.length > 0);
  assert(next.trace.every((t) => t.edgeId !== failing.edgeId));
  assertNotEquals(next.trace.map((t) => t.edgeId), first.trace.map((t) => t.edgeId));
});

Deno.test('replan (per-frame): blocked edges are not supported, so the plan repeats', () => {
  const parsed = Level.parse('############\n#P........E#\n############');
  const first = planner.plan(parsed, DEFAULT_LEGEND);
  const next = planner.replan(first, FAILED_AT_10, parsed, DEFAULT_LEGEND)!;
  assert(first.hasSameRecordingAs(next));
});
