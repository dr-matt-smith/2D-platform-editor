import { assertEquals } from '@std/assert';
import { SourceEditor } from './SourceEditor.ts';

Deno.test('gutterText numbers each line, one per row', () => {
  assertEquals(SourceEditor.gutterText(3), '1\n2\n3\n');
  assertEquals(SourceEditor.gutterText(0), '');
});

Deno.test('rulerText marks every 10th column | and every 5th +', () => {
  assertEquals(SourceEditor.rulerText(12), '|····+····|·');
});
