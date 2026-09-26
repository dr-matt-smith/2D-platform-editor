import { assertEquals } from '@std/assert';
import { LevelFile } from './LevelFile.ts';
import { Level } from '@2d-platform/level-format';

Deno.test('filename is sanitised <id>.txt', () => {
  assertEquals(LevelFile.from('above_ground', 'x').filename, 'above_ground.txt');
  assertEquals(LevelFile.from('a b/c', 'x').filename, 'a_b_c.txt');
  assertEquals(LevelFile.from('', 'x').filename, 'level.txt');
  assertEquals(LevelFile.from(null, 'x').filename, 'level.txt');
});

Deno.test('content round-trips through the parser (no phantom trailing row)', () => {
  const buf = '# name: r\n# size: 3x2\n###\n#P#';
  for (const text of [buf, buf + '\n', buf + '\n\n']) {
    const { content } = LevelFile.from('r', text);
    assertEquals(Level.parse(content).grid, Level.parse(buf).grid);
    assertEquals(Level.parse(content).meta.height, 2);
  }
});
