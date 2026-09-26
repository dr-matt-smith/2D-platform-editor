import { assert, assertEquals, assertFalse } from '@std/assert';
import { ActionKind } from './ActionKind.ts';
import { Plan } from './Plan.ts';
import type { Recording } from './RecordingEvent.ts';
import type { TraceEntry } from './TraceEntry.ts';

const step = (from: number, to: number, edgeId: string): TraceEntry => ({
  kind: ActionKind.Walk,
  target: { r: 1, c: 1 },
  why: 'walk right toward exit at (3,1)',
  frameRange: [from, to],
  edgeId,
});

const planOf = (trace: TraceEntry[], recording: Recording = []) =>
  new Plan({
    trace,
    recording,
    stats: { steps: trace.length, jumps: 0, walks: trace.length, drops: 0 },
    graph: null,
    goals: [],
    unreachable: [],
  });

Deno.test('Plan.empty has no steps and zero stats', () => {
  const p = Plan.empty(null);
  assert(p.isEmpty);
  assertEquals(p.recording, []);
  assertEquals(p.stats, { steps: 0, jumps: 0, walks: 0, drops: 0 });
  assertEquals(p.goals, []);
});

Deno.test('stepAtFrame: the step whose frame range holds the frame; after the end, the last step', () => {
  const p = planOf([step(1, 6, 'a'), step(6, 48, 'b')]);
  assertEquals(p.stepAtFrame(1)?.edgeId, 'a');
  assertEquals(p.stepAtFrame(5)?.edgeId, 'a');
  assertEquals(p.stepAtFrame(6)?.edgeId, 'b');
  assertEquals(p.stepAtFrame(500)?.edgeId, 'b');
  assertEquals(Plan.empty(null).stepAtFrame(3), undefined);
});

Deno.test('longestStepNotIn: the longest unblocked step (first on a tie), or null', () => {
  const p = planOf([step(1, 6, 'a'), step(6, 48, 'b'), step(48, 90, 'c')]);
  assertEquals(p.longestStepNotIn(new Set()), 'b');
  assertEquals(p.longestStepNotIn(new Set(['b'])), 'c');
  assertEquals(p.longestStepNotIn(new Set(['a', 'b', 'c'])), null);
});

Deno.test('hasSameRecordingAs / recordingKey compare key events', () => {
  const rec = [{ frame: 1, key: 'right', down: true }, { frame: 6, key: 'right', down: false }];
  const a = planOf([], rec);
  const b = planOf([], rec.map((e) => ({ ...e })));
  const c = planOf([], [{ frame: 1, key: 'right', down: true }]);
  assert(a.hasSameRecordingAs(b));
  assertFalse(a.hasSameRecordingAs(c));
  assertEquals(a.recordingKey(), '1|right|1,6|right|0');
  assertEquals(a.recordingKey(), b.recordingKey());
});
