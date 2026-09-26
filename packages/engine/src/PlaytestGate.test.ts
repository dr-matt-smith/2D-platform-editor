import { assert, assertEquals } from '@std/assert';
import { Legend, Level, LevelValidator, Role, Severity } from '@2d-platform/level-format';
import { PlaytestGate } from './PlaytestGate.ts';

Deno.test('a clean level (one P, an E, no errors) is launchable', () => {
  const g = new PlaytestGate().check(Level.parse('#####\n#P.E#\n#####'));
  assertEquals(g.ok, true);
  assertEquals(g.reasons, []);
});

Deno.test('an undefined glyph blocks launch', () => {
  const g = new PlaytestGate().check(Level.parse('P.E\n.Z.'));
  assertEquals(g.ok, false);
  assert(g.reasons.some((r) => /undefined glyph/.test(r.message)));
});

Deno.test('two player spawns block launch', () => {
  const g = new PlaytestGate().check(Level.parse('P.P\n..E'));
  assertEquals(g.ok, false);
  assert(g.reasons.some((r) => /extra player spawn/.test(r.message)));
});

Deno.test('no player spawn blocks launch', () => {
  const g = new PlaytestGate().check(Level.parse('...\n..E'));
  assertEquals(g.ok, false);
  assert(g.reasons.some((r) => /no player spawn/.test(r.message)));
});

Deno.test('missing E blocks playtest even though validate only WARNS for it', () => {
  const parsed = Level.parse('#####\n#P..#\n#####');
  // The editor lint treats a missing exit as a non-blocking warning …
  const issues = new LevelValidator().validate(parsed);
  assertEquals(
    issues.filter((i) => i.severity === Severity.Error).length,
    0,
    'no validator errors for this level',
  );
  assert(issues.some((i) => i.severity === Severity.Warn && /no exit/.test(i.message)));
  // … but the play gate promotes it to a blocker (stricter, by design §4.1).
  const g = new PlaytestGate().check(parsed);
  assertEquals(g.ok, false);
  assert(g.reasons.some((r) => /needs an exit/.test(r.message)));
});

Deno.test('reasons use the validator issue shape (line/col/severity/message)', () => {
  const g = new PlaytestGate().check(Level.parse('...'));
  for (const r of g.reasons) {
    assertEquals(typeof r.line, 'number');
    assertEquals(typeof r.col, 'number');
    assertEquals(r.severity, Severity.Error);
    assertEquals(typeof r.message, 'string');
  }
});

// --- v11 role-driven exit detection ----------------------------------

Deno.test('v11: exit detected by ROLE, not literal "E"', () => {
  // A tileset where the exit char is '$' (e.g. a treasure-chest goal).
  const legend = Legend.fromRecord({
    '.': { role: Role.Background },
    P:   { role: Role.Player },
    $:   { role: Role.Exit },
  });
  const g = new PlaytestGate(legend).check(Level.parse('P.$'));
  assertEquals(g.ok, true);
  assertEquals(g.reasons, []);
});

Deno.test('v11: no role:exit anywhere → blocked even though "E" is undefined glyph', () => {
  const legend = Legend.fromRecord({ '.': { role: Role.Background }, P: { role: Role.Player } });
  const g = new PlaytestGate(legend).check(Level.parse('P..'));
  assertEquals(g.ok, false);
  // The 'no exit' reason is present even when the legend lacks an
  // exit-role char entirely.
  assert(g.reasons.some((r) => /needs an exit/.test(r.message)));
});
