// Shipped-level regression gates: plan() + simulate() against the
// levels in content/data/levels/. Ported from the editor e2e specs that
// only used the browser as a module loader; the Test-button variants of
// these sweeps stay in apps/editor/e2e/ because they exercise the dialog.
import { assert, assertEquals } from '@std/assert';
import { parse, DEFAULT_LEGEND } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import { plan } from './planner.ts';
import { simulate } from './sim.ts';

function readLevel(file: string): string {
  return Deno.readTextFileSync(`content/data/levels/${file}`);
}

// --- below_ground.txt progress gates (v25 → v28) --------------------

Deno.test('v25 M3: below_ground.txt — progress past frame 49 + score > 0', () => {
  const parsed = parse(readLevel('below_ground.txt'));
  const p = plan(parsed, DEFAULT_LEGEND, { adapter: jsAdapter });
  const sim = simulate({ adapter: jsAdapter, parsed, legend: DEFAULT_LEGEND, recording: p.recording, maxFrames: 1200 });
  // v24 M5: died at frame 49 with score 0.
  // v25 M2: gets past frame 49; collects pickups along the way.
  // v26+ (3.1.b architecture): outcome 'won' with full pickups.
  if (sim.outcome !== 'won') {
    // Partial progress assertion. Score > 0 AND past the v24 death.
    assert(sim.frame > 49, `frame ${sim.frame}`);
    assert(sim.score > 0, `score ${sim.score}`);
  }
});

Deno.test('v26 M5: below_ground PROGRESS — score advances over v25 baseline', () => {
  const parsed = parse(readLevel('below_ground.txt'));
  const p = plan(parsed, DEFAULT_LEGEND, { adapter: jsAdapter });
  const sim = simulate({ adapter: jsAdapter, parsed, legend: DEFAULT_LEGEND, recording: p.recording, maxFrames: 2400 });
  // 'won' means the v27+ full-solve fix has landed; otherwise assert
  // MINIMUM v25 parity (score >= 8).
  if (sim.outcome !== 'won') {
    assert(sim.score >= 8, `score ${sim.score}`);
  }
});

Deno.test('v27 M5: below_ground PROGRESS — score advances over v25 baseline', () => {
  const parsed = parse(readLevel('below_ground.txt'));
  const p = plan(parsed, DEFAULT_LEGEND, { adapter: jsAdapter });
  const sim = simulate({ adapter: jsAdapter, parsed, legend: DEFAULT_LEGEND, recording: p.recording, maxFrames: 2400 });
  if (sim.outcome !== 'won') {
    assert(sim.score >= 8, `score ${sim.score}`);
  }
});

Deno.test('v28 M5: below_ground.txt solves end-to-end via plan() + simulate()', () => {
  const parsed = parse(readLevel('below_ground.txt'));
  const t0 = performance.now();
  const p = plan(parsed, DEFAULT_LEGEND, { adapter: jsAdapter });
  const planMs = performance.now() - t0;
  const sim = simulate({ adapter: jsAdapter, parsed, legend: DEFAULT_LEGEND, recording: p.recording, maxFrames: 2400 });
  assertEquals(sim.outcome, 'won');
  assertEquals(sim.score, 16);
  // Plan should be well within the 5s primary budget on this level.
  assert(planMs < 5000, `planMs ${planMs}`);
});

// --- v28 M3: per-frame planner sweep ---------------------------------
// Every shipped agent-suite level solves under opts.planner='perframe'.

for (const file of ['tutorial.txt', 'simple.txt', 'above_ground.txt', 'below_ground.txt']) {
  Deno.test(`v28 M3: ${file} solves under planner='perframe'`, () => {
    const parsed = parse(readLevel(file));
    const p = plan(parsed, DEFAULT_LEGEND, { adapter: jsAdapter, planner: 'perframe' });
    const sim = simulate({ adapter: jsAdapter, parsed, legend: DEFAULT_LEGEND, recording: p.recording, maxFrames: 2400 });
    assertEquals(sim.outcome, 'won');
    assert(p.trace.length > 0);
  });
}
