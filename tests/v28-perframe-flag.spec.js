// v28 M3: per-frame A* core, gated by opts.planner='perframe'. The
// default backend stays 'bucket' until M4 flips it. This spec sweeps
// every shipped agent-suite level under the new flag and asserts the
// recording solves end-to-end via simulate().

import { test, expect } from '@playwright/test';

const LEVELS = ['tutorial.txt', 'simple.txt', 'above_ground.txt', 'below_ground.txt'];

for (const file of LEVELS) {
  test(`v28 M3: ${file} solves under planner='perframe'`, async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#preview');
    const out = await page.evaluate(async (f) => {
      const r = await fetch('data/levels/' + f);
      const text = await r.text();
      const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
      const { plan } = await import('/src/agent/planner.js');
      const { simulate } = await import('/src/agent/sim.js');
      const parsed = parse(text);
      const p = plan(parsed, DEFAULT_LEGEND, { planner: 'perframe' });
      const sim = simulate({ parsed, legend: DEFAULT_LEGEND, recording: p.recording, maxFrames: 2400 });
      return { outcome: sim.outcome, score: sim.score, traceLen: p.trace.length };
    }, file);
    expect(out.outcome).toBe('won');
    expect(out.traceLen).toBeGreaterThan(0);
  });
}

// Note: v28 M3 originally asserted the default backend stayed 'bucket';
// M4 flips the default to 'perframe', so that assertion has moved to
// v28-perframe-default.spec.js. This file's per-level sweep still
// verifies the explicit opts.planner='perframe' contract.
