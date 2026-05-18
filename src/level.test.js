import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, serialize } from './level.js';

const SAMPLE = `# name: tutorial-01
# size: 20x6
####################
#..................#
#...P..............#
#........####.....E#
#........oooo......#
####################`;

test('parse reads header directives', () => {
  const { meta } = parse(SAMPLE);
  assert.equal(meta.name, 'tutorial-01');
  assert.deepEqual(meta.declared, { w: 20, h: 6 });
  assert.equal(meta.width, 20);
  assert.equal(meta.height, 6);
});

test('theme directive: defaults to sky, parses cave, rejects unknown', () => {
  assert.equal(parse('###').meta.theme, 'sky');
  assert.equal(parse('# theme: cave\n###').meta.theme, 'cave');
  assert.equal(parse('# theme: lava\n###').meta.theme, 'sky');
});

test('grid rows are padded to the declared width', () => {
  const { grid } = parse('# size: 5x1\n##');
  assert.deepEqual(grid, ['##...']);
});

test('// lines are stripped as comments', () => {
  const { grid, rows } = parse('// note\n# size: 3x1\n// mid\n###');
  assert.deepEqual(grid, ['###']);
  assert.equal(rows[0].line, 4); // original file line preserved
});

test('a wall row is not mistaken for a directive', () => {
  const { meta, grid } = parse('####\n#..#');
  assert.equal(meta.name, null);
  assert.deepEqual(grid, ['####', '#..#']);
});

test('parse -> serialize -> parse round-trips', () => {
  const a = parse(SAMPLE);
  const b = parse(serialize(a));
  assert.deepEqual(b.meta, a.meta);
  assert.deepEqual(b.grid, a.grid);
});

test('round-trip preserves a non-default theme', () => {
  const a = parse('# name: cave1\n# theme: cave\n# size: 3x1\n#P#');
  const text = serialize(a);
  assert.match(text, /# theme: cave/);
  assert.equal(parse(text).meta.theme, 'cave');
});
