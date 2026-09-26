import { assertEquals } from '@std/assert';
import { DragFillTool } from './DragFillTool.ts';

const cell = (cx: number, cy: number) => ({ cx, cy, inHud: false });

Deno.test('apply fills the rectangle and keeps the header and comments', () => {
  const text = '# name: t\n.....\n// note\n.....\n.....';
  assertEquals(
    DragFillTool.apply(text, cell(3, 1), cell(1, 0), '#', false),
    '# name: t\n.###.\n// note\n.###.\n.....',
  );
});

Deno.test('apply with outline paints only the border', () => {
  const text = '.....\n.....\n.....';
  assertEquals(
    DragFillTool.apply(text, cell(0, 0), cell(4, 2), 'o', true),
    'ooooo\no...o\nooooo',
  );
});

Deno.test('apply returns null when the text has no grid', () => {
  assertEquals(DragFillTool.apply('# name: empty', cell(0, 0), cell(1, 1), '#', false), null);
});
