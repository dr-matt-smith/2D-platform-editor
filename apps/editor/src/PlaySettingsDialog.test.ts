import { assertEquals } from '@std/assert';
import { PlaySettingsDialog } from './PlaySettingsDialog.ts';

Deno.test('initialPickup maps the directive to a radio and a starting N', () => {
  assertEquals(PlaySettingsDialog.initialPickup('all', 5), { mode: 'all', n: 1 });
  assertEquals(PlaySettingsDialog.initialPickup(0, 5), { mode: 'none', n: 1 });
  assertEquals(PlaySettingsDialog.initialPickup(3, 5), { mode: 'min', n: 3 });
  assertEquals(PlaySettingsDialog.initialPickup('all', 0), { mode: 'all', n: 1 });
});

Deno.test('readPickup: all / none / at least N (junk N → 1)', () => {
  assertEquals(PlaySettingsDialog.readPickup('all', '4'), 'all');
  assertEquals(PlaySettingsDialog.readPickup('none', '4'), 0);
  assertEquals(PlaySettingsDialog.readPickup('min', '4.7'), 4);
  assertEquals(PlaySettingsDialog.readPickup('min', ''), 1);
  assertEquals(PlaySettingsDialog.readPickup('min', '-2'), 1);
});

Deno.test('readViewport: fit → null; window → floored W×H (junk → 20×12)', () => {
  assertEquals(PlaySettingsDialog.readViewport('fit', '30', '10'), null);
  assertEquals(PlaySettingsDialog.readViewport('window', '30.9', '10'), { w: 30, h: 10 });
  assertEquals(PlaySettingsDialog.readViewport('window', 'x', '0'), { w: 20, h: 12 });
});
