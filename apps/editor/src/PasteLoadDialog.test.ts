import { assertEquals, assertMatch } from '@std/assert';
import { PasteLoadDialog } from './PasteLoadDialog.ts';

Deno.test('problemWith accepts any text with a grid, even an invalid level', () => {
  assertEquals(PasteLoadDialog.problemWith('#####\n#P.E#\n#####'), null);
  assertEquals(PasteLoadDialog.problemWith('.....'), null); // no player or exit: still loads
});

Deno.test('problemWith refuses text with no grid', () => {
  assertMatch(PasteLoadDialog.problemWith('# name: nothing here') ?? '', /No level grid/);
  assertMatch(PasteLoadDialog.problemWith('') ?? '', /No level grid/);
});

Deno.test('nameIn reads the # name: line', () => {
  assertEquals(PasteLoadDialog.nameIn('# size: 3x3\n#  name :  My Level  \n###'), 'My Level');
  assertEquals(PasteLoadDialog.nameIn('###'), null);
});
