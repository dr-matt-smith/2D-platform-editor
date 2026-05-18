import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLevelFile } from './download.js';
import { parse } from './level.js';

test('filename is sanitised <id>.txt', () => {
  assert.equal(toLevelFile('above_ground', 'x').filename, 'above_ground.txt');
  assert.equal(toLevelFile('a b/c', 'x').filename, 'a_b_c.txt');
  assert.equal(toLevelFile('', 'x').filename, 'level.txt');
});

test('content round-trips through the parser (no phantom trailing row)', () => {
  const buf = '# name: r\n# size: 3x2\n###\n#P#';
  for (const text of [buf, buf + '\n', buf + '\n\n']) {
    const { content } = toLevelFile('r', text);
    assert.deepEqual(parse(content).grid, parse(buf).grid);
    assert.equal(parse(content).meta.height, 2);
  }
});
