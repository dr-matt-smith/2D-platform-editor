import { assert, assertEquals } from '@std/assert';
import { Legend } from './Legend.ts';
import { Level } from './Level.ts';
import { LevelValidator } from './LevelValidator.ts';
import { Role } from './Role.ts';
import { Severity } from './Severity.ts';
import type { ValidationIssue } from './ValidationIssue.ts';

const find = (issues: ValidationIssue[], re: RegExp) => issues.find((i) => re.test(i.message));
const validate = (text: string, legend?: Legend) => new LevelValidator(legend).validate(Level.parse(text));
const errors = (issues: ValidationIssue[]) => issues.filter((i) => i.severity === Severity.Error);

Deno.test('a valid level produces no errors', () => {
  assertEquals(errors(validate('####\n#PE#\n####')).length, 0);
});

Deno.test('two P spawns: extra one flagged with its line/col', () => {
  const extra = find(validate('P..\n..P'), /extra player spawn/);
  assert(extra);
  assertEquals(extra.line, 2);
  assertEquals(extra.col, 3);
});

Deno.test('missing player spawn is an error', () => {
  assert(find(validate('###\n#E#'), /no player spawn/));
});

Deno.test('undefined glyph reported at line/col', () => {
  const bad = find(validate('# size: 3x1\n#Z#'), /undefined glyph 'Z'/);
  assert(bad);
  assertEquals(bad.line, 2);
  assertEquals(bad.col, 2);
});

Deno.test('declared size mismatch is an error', () => {
  assert(find(validate('# size: 3x5\nP##'), /declared height 5 but found 1/));
});

Deno.test('missing exit is a warning, not an error', () => {
  const e = find(validate('P..'), /no exit/);
  assertEquals(e!.severity, Severity.Warn);
});

Deno.test('valid-glyph set comes from the passed legend (tileset-aware)', () => {
  // Default (Dirt) legend: `o` is valid.
  assertEquals(find(validate('PoE'), /undefined glyph 'o'/), undefined);
  // A custom legend without `o`: same level now flags `o`.
  const legend = Legend.fromRecord({
    '.': { role: Role.Background },
    P: { role: Role.Player },
    E: { role: Role.Exit },
  });
  const bad = find(validate('PoE', legend), /undefined glyph 'o'/);
  assert(bad);
  assertEquals(bad.col, 2);
});

// --- role-driven validation --------------------------------------------

Deno.test('a tileset rebinding the player char ("@" → role player) still validates', () => {
  // Authoring story: a tileset's tile_lookup declares the spawn glyph
  // as '@' with role:player. The validator must not hardcode 'P'.
  const legend = Legend.fromRecord({
    '.': { role: Role.Background },
    '@': { role: Role.Player },
    E: { role: Role.Exit },
  });
  const issues = validate('@.E', legend);
  assertEquals(errors(issues).length, 0);
  assertEquals(find(issues, /no exit/), undefined); // exit by role, not literal 'E'
});

Deno.test('multi-char hazard glyphs both count, neither flags as undefined', () => {
  // A tileset with both '^' (spike) and '*' (fire) as hazards.
  const legend = Legend.fromRecord({
    '.': { role: Role.Background },
    P: { role: Role.Player },
    E: { role: Role.Exit },
    '^': { role: Role.Hazard },
    '*': { role: Role.Hazard },
  });
  assertEquals(errors(validate('P^*E', legend)).length, 0);
});

Deno.test('a legend missing role:player flags "no player spawn"', () => {
  // Note this is the legend, not the level — the legend doesn't classify
  // any char as a player, so even though 'P' is defined the validator
  // counts zero player spawns.
  const legend = Legend.fromRecord({
    '.': { role: Role.Background },
    P: { role: Role.Pickup }, // declared as a pickup, not a spawn
    E: { role: Role.Exit },
  });
  assert(find(validate('PE', legend), /no player spawn/));
});

Deno.test('a decoration glyph is paintable + valid, neither spawn nor hazard', () => {
  const legend = Legend.fromRecord({
    '.': { role: Role.Background },
    '#': { role: Role.Terrain },
    P: { role: Role.Player },
    E: { role: Role.Exit },
    T: { role: Role.Decoration }, // a tree — visual only
  });
  const issues = validate('PTE', legend);
  assertEquals(errors(issues).length, 0);
  assertEquals(find(issues, /undefined glyph 'T'/), undefined);
});

// --- the class itself ---------------------------------------------------

Deno.test('the default legend is Legend.DEFAULT', () => {
  const level = Level.parse('PoE');
  assertEquals(new LevelValidator().validate(level), new LevelValidator(Legend.DEFAULT).validate(level));
});

Deno.test('issues come out in rule order: glyphs, spawns, exit, size', () => {
  const issues = validate('# size: 3x2\nZ..');
  assertEquals(issues.map((i) => i.message), [
    "undefined glyph 'Z'",
    'no player spawn (expected exactly one)',
    'no exit in level',
    'declared height 2 but found 1 rows',
  ]);
});

Deno.test('a plain LevelData object validates the same as a Level', () => {
  const level = Level.parse('# size: 2x1\nPE#');
  const plain = { meta: level.meta, grid: [...level.grid], rows: [...level.rows] };
  assertEquals(new LevelValidator().validate(plain), new LevelValidator().validate(level));
  assertEquals(find(new LevelValidator().validate(plain), /row exceeds declared width 2 \(3 chars\)/)?.col, 3);
});
