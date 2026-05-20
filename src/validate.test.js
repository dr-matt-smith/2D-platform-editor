import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from './level.js';
import { validate } from './validate.js';

const find = (issues, re) => issues.find((i) => re.test(i.message));

test('a valid level produces no errors', () => {
  const issues = validate(parse('####\n#PE#\n####'));
  assert.equal(issues.filter((i) => i.severity === 'error').length, 0);
});

test('two P spawns: extra one flagged with its line/col', () => {
  const issues = validate(parse('P..\n..P'));
  const extra = find(issues, /extra player spawn/);
  assert.ok(extra);
  assert.equal(extra.line, 2);
  assert.equal(extra.col, 3);
});

test('missing player spawn is an error', () => {
  assert.ok(find(validate(parse('###\n#E#')), /no player spawn/));
});

test('undefined glyph reported at line/col', () => {
  const issues = validate(parse('# size: 3x1\n#Z#'));
  const bad = find(issues, /undefined glyph 'Z'/);
  assert.ok(bad);
  assert.equal(bad.line, 2);
  assert.equal(bad.col, 2);
});

test('declared size mismatch is an error', () => {
  const issues = validate(parse('# size: 3x5\nP##'));
  assert.ok(find(issues, /declared height 5 but found 1/));
});

test('missing exit is a warning, not an error', () => {
  const issues = validate(parse('P..'));
  const e = find(issues, /no exit/);
  assert.equal(e.severity, 'warn');
});

test('valid-glyph set comes from the passed legend (tileset-aware)', () => {
  // Default (Dirt) legend: `o` is valid.
  assert.equal(find(validate(parse('PoE')), /undefined glyph 'o'/), undefined);
  // A custom legend without `o`: same level now flags `o`.
  const legend = {
    '.': { role: 'background' },
    P: { role: 'player' },
    E: { role: 'exit' },
  };
  const bad = find(validate(parse('PoE'), legend), /undefined glyph 'o'/);
  assert.ok(bad);
  assert.equal(bad.col, 2);
});

// --- v11 role-driven validation --------------------------------------

test('v11: a tileset rebinding the player char ("@" → role player) still validates', () => {
  // Authoring story: a tileset's tile_lookup declares the spawn glyph
  // as '@' with role:player. The validator must not hardcode 'P'.
  const legend = {
    '.': { role: 'background' },
    '@': { role: 'player' },
    E:   { role: 'exit' },
  };
  const issues = validate(parse('@.E'), legend);
  assert.equal(issues.filter((i) => i.severity === 'error').length, 0);
  assert.equal(find(issues, /no exit/), undefined); // exit by role, not literal 'E'
});

test('v11: multi-char hazard glyphs both count, neither flags as undefined', () => {
  // A tileset with both '^' (spike) and '*' (fire) as hazards.
  const legend = {
    '.': { role: 'background' },
    P:   { role: 'player' },
    E:   { role: 'exit' },
    '^': { role: 'hazard' },
    '*': { role: 'hazard' },
  };
  const issues = validate(parse('P^*E'), legend);
  assert.equal(issues.filter((i) => i.severity === 'error').length, 0);
});

test('v11: a legend missing role:player flags "no player spawn"', () => {
  // Note this is the legend, not the level — the legend doesn't classify
  // any char as 'player', so even though 'P' is defined the validator
  // counts zero player spawns.
  const legend = {
    '.': { role: 'background' },
    P:   { role: 'pickup' }, // declared as a pickup, not a spawn
    E:   { role: 'exit' },
  };
  assert.ok(find(validate(parse('PE'), legend), /no player spawn/));
});

test('v11: a decoration glyph is paintable + valid, neither spawn nor hazard', () => {
  const legend = {
    '.': { role: 'background' },
    '#': { role: 'terrain' },
    P:   { role: 'player' },
    E:   { role: 'exit' },
    T:   { role: 'decoration' }, // a tree — visual only
  };
  const issues = validate(parse('PTE'), legend);
  assert.equal(issues.filter((i) => i.severity === 'error').length, 0);
  assert.equal(find(issues, /undefined glyph 'T'/), undefined);
});
