import { assertEquals } from '@std/assert';
import { KeyboardShortcuts } from './KeyboardShortcuts.ts';
import { Shortcut } from './Shortcut.ts';

const press = (key: string, mods: { meta?: boolean; ctrl?: boolean; shift?: boolean } = { ctrl: true }) =>
  KeyboardShortcuts.commandFor({
    key,
    metaKey: mods.meta ?? false,
    ctrlKey: mods.ctrl ?? false,
    shiftKey: mods.shift ?? false,
  });

Deno.test('Ctrl or Cmd with O / Enter / Z / Shift+Z / Y', () => {
  assertEquals(press('o'), Shortcut.OpenLevels);
  assertEquals(press('Enter', { meta: true }), Shortcut.Play);
  assertEquals(press('z'), Shortcut.Undo);
  assertEquals(press('Z', { ctrl: true, shift: true }), Shortcut.Redo);
  assertEquals(press('y', { meta: true }), Shortcut.Redo);
});

Deno.test('keys without Ctrl/Cmd, and other keys, are not shortcuts', () => {
  assertEquals(press('z', {}), null);
  assertEquals(press('Enter', { shift: true }), null);
  assertEquals(press('s'), null);
});
