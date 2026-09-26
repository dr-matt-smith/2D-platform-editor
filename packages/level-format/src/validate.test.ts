import { assert, assertEquals } from '@std/assert';
import { parse } from './level.ts';
import type { RoleLegend } from './level.ts';
import { validate } from './validate.ts';
import type { ValidationIssue } from './validate.ts';

const find = (issues: ValidationIssue[], re: RegExp) => issues.find((i) => re.test(i.message));

Deno.test('a valid level produces no errors', () => {
  const issues = validate(parse('####\n#PE#\n####'));
  assertEquals(issues.filter((i) => i.severity === 'error').length, 0);
});

Deno.test('two P spawns: extra one flagged with its line/col', () => {
  const issues = validate(parse('P..\n..P'));
  const extra = find(issues, /extra player spawn/);
  assert(extra);
  assertEquals(extra.line, 2);
  assertEquals(extra.col, 3);
});

Deno.test('missing player spawn is an error', () => {
  assert(find(validate(parse('###\n#E#')), /no player spawn/));
});

Deno.test('undefined glyph reported at line/col', () => {
  const issues = validate(parse('# size: 3x1\n#Z#'));
  const bad = find(issues, /undefined glyph 'Z'/);
  assert(bad);
  assertEquals(bad.line, 2);
  assertEquals(bad.col, 2);
});

Deno.test('declared size mismatch is an error', () => {
  const issues = validate(parse('# size: 3x5\nP##'));
  assert(find(issues, /declared height 5 but found 1/));
});

Deno.test('missing exit is a warning, not an error', () => {
  const issues = validate(parse('P..'));
  const e = find(issues, /no exit/);
  assertEquals(e!.severity, 'warn');
});

Deno.test('valid-glyph set comes from the passed legend (tileset-aware)', () => {
  // Default (Dirt) legend: `o` is valid.
  assertEquals(find(validate(parse('PoE')), /undefined glyph 'o'/), undefined);
  // A custom legend without `o`: same level now flags `o`.
  const legend: RoleLegend = {
    '.': { role: 'background' },
    P: { role: 'player' },
    E: { role: 'exit' },
  };
  const bad = find(validate(parse('PoE'), legend), /undefined glyph 'o'/);
  assert(bad);
  assertEquals(bad.col, 2);
});

// --- v11 role-driven validation --------------------------------------

Deno.test('v11: a tileset rebinding the player char ("@" → role player) still validates', () => {
  // Authoring story: a tileset's tile_lookup declares the spawn glyph
  // as '@' with role:player. The validator must not hardcode 'P'.
  const legend: RoleLegend = {
    '.': { role: 'background' },
    '@': { role: 'player' },
    E:   { role: 'exit' },
  };
  const issues = validate(parse('@.E'), legend);
  assertEquals(issues.filter((i) => i.severity === 'error').length, 0);
  assertEquals(find(issues, /no exit/), undefined); // exit by role, not literal 'E'
});

Deno.test('v11: multi-char hazard glyphs both count, neither flags as undefined', () => {
  // A tileset with both '^' (spike) and '*' (fire) as hazards.
  const legend: RoleLegend = {
    '.': { role: 'background' },
    P:   { role: 'player' },
    E:   { role: 'exit' },
    '^': { role: 'hazard' },
    '*': { role: 'hazard' },
  };
  const issues = validate(parse('P^*E'), legend);
  assertEquals(issues.filter((i) => i.severity === 'error').length, 0);
});

Deno.test('v11: a legend missing role:player flags "no player spawn"', () => {
  // Note this is the legend, not the level — the legend doesn't classify
  // any char as 'player', so even though 'P' is defined the validator
  // counts zero player spawns.
  const legend: RoleLegend = {
    '.': { role: 'background' },
    P:   { role: 'pickup' }, // declared as a pickup, not a spawn
    E:   { role: 'exit' },
  };
  assert(find(validate(parse('PE'), legend), /no player spawn/));
});

Deno.test('v11: a decoration glyph is paintable + valid, neither spawn nor hazard', () => {
  const legend: RoleLegend = {
    '.': { role: 'background' },
    '#': { role: 'terrain' },
    P:   { role: 'player' },
    E:   { role: 'exit' },
    T:   { role: 'decoration' }, // a tree — visual only
  };
  const issues = validate(parse('PTE'), legend);
  assertEquals(issues.filter((i) => i.severity === 'error').length, 0);
  assertEquals(find(issues, /undefined glyph 'T'/), undefined);
});
