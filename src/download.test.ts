import { assertEquals } from '@std/assert';
import { toLevelFile } from './download.ts';
import { parse } from './level.ts';

Deno.test('filename is sanitised <id>.txt', () => {
  assertEquals(toLevelFile('above_ground', 'x').filename, 'above_ground.txt');
  assertEquals(toLevelFile('a b/c', 'x').filename, 'a_b_c.txt');
  assertEquals(toLevelFile('', 'x').filename, 'level.txt');
});

Deno.test('content round-trips through the parser (no phantom trailing row)', () => {
  const buf = '# name: r\n# size: 3x2\n###\n#P#';
  for (const text of [buf, buf + '\n', buf + '\n\n']) {
    const { content } = toLevelFile('r', text);
    assertEquals(parse(content).grid, parse(buf).grid);
    assertEquals(parse(content).meta.height, 2);
  }
});
