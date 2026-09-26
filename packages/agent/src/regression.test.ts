// Shipped-level regression gates: Planner.plan + Simulator.run against the
// levels in content/data/levels/. The Test-button versions of these
// sweeps stay in apps/editor/e2e/ because they exercise the dialog.
import { assert, assertEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import { PlannerFactory } from './PlannerFactory.ts';
import { PlannerKind } from './PlannerKind.ts';
import { SimOutcome } from './SimOutcome.ts';
import { Simulator } from './Simulator.ts';

// The agent takes legends as plain records.
const DEFAULT_LEGEND = Legend.DEFAULT.toRecord();

const planner = PlannerFactory.create(jsAdapter);
const simulator = new Simulator(jsAdapter);

function readLevel(file: string): string {
  return Deno.readTextFileSync(`content/data/levels/${file}`);
}

// --- below_ground.txt progress gates --------------------------------

Deno.test('below_ground.txt — progress past frame 49 + score > 0', () => {
  const parsed = Level.parse(readLevel('below_ground.txt'));
  const p = planner.plan(parsed, DEFAULT_LEGEND);
  const sim = simulator.run(parsed, DEFAULT_LEGEND, p.recording, { maxFrames: 1200 });
  // Early planners died at frame 49 with score 0; now it should win.
  if (sim.outcome !== SimOutcome.Won) {
    assert(sim.frame > 49, `frame ${sim.frame}`);
    assert(sim.score > 0, `score ${sim.score}`);
  }
});

Deno.test('below_ground PROGRESS — score at least the old baseline of 8', () => {
  const parsed = Level.parse(readLevel('below_ground.txt'));
  const p = planner.plan(parsed, DEFAULT_LEGEND);
  const sim = simulator.run(parsed, DEFAULT_LEGEND, p.recording, { maxFrames: 2400 });
  if (sim.outcome !== SimOutcome.Won) {
    assert(sim.score >= 8, `score ${sim.score}`);
  }
});

Deno.test('below_ground.txt solves end-to-end via Planner.plan + Simulator.run', () => {
  const parsed = Level.parse(readLevel('below_ground.txt'));
  const t0 = performance.now();
  const p = planner.plan(parsed, DEFAULT_LEGEND);
  const planMs = performance.now() - t0;
  const sim = simulator.run(parsed, DEFAULT_LEGEND, p.recording, { maxFrames: 2400 });
  assertEquals(sim.outcome, SimOutcome.Won);
  assertEquals(sim.score, 16);
  // Well within the 5 s primary budget.
  assert(planMs < 5000, `planMs ${planMs}`);
});

// --- per-frame planner sweep -----------------------------------------

for (const file of ['tutorial.txt', 'simple.txt', 'above_ground.txt', 'below_ground.txt']) {
  Deno.test(`${file} solves under the per-frame planner`, () => {
    const parsed = Level.parse(readLevel(file));
    const p = PlannerFactory.create(jsAdapter, PlannerKind.PerFrame).plan(parsed, DEFAULT_LEGEND);
    const sim = simulator.run(parsed, DEFAULT_LEGEND, p.recording, { maxFrames: 2400 });
    assertEquals(sim.outcome, SimOutcome.Won);
    assert(p.trace.length > 0);
  });
}
