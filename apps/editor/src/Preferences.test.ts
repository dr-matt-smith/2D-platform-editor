import { assertEquals } from '@std/assert';
import { EditorTheme } from './EditorTheme.ts';
import { LegendLayout } from './LegendLayout.ts';
import { MemoryStore } from './MemoryStore.ts';
import { Preferences } from './Preferences.ts';

Deno.test('defaults when nothing is stored', () => {
  const prefs = new Preferences(new MemoryStore());
  assertEquals(prefs.legendLayout, LegendLayout.Right);
  assertEquals(prefs.legendCollapsed, false);
  assertEquals(prefs.fitToScreen, false);
  assertEquals(prefs.theme, null);
  assertEquals(prefs.dialogMinimised, false);
});

Deno.test('reads the strings the editor has always stored', () => {
  const prefs = new Preferences(new MemoryStore({
    'v22.legendLayout': 'bottom',
    'v22.legendCollapsed': 'true',
    'v22.fitToScreen': 'true',
    'v23.theme': 'light',
    'v23.dialogMinimised': 'true',
  }));
  assertEquals(prefs.legendLayout, LegendLayout.Bottom);
  assertEquals(prefs.legendCollapsed, true);
  assertEquals(prefs.fitToScreen, true);
  assertEquals(prefs.theme, EditorTheme.Light);
  assertEquals(prefs.dialogMinimised, true);
});

Deno.test('writes round-trip as plain strings', () => {
  const store = new MemoryStore();
  const prefs = new Preferences(store);
  prefs.legendLayout = LegendLayout.Bottom;
  prefs.fitToScreen = true;
  prefs.theme = EditorTheme.Dark;
  assertEquals(store.getItem('v22.legendLayout'), 'bottom');
  assertEquals(store.getItem('v22.fitToScreen'), 'true');
  assertEquals(store.getItem('v23.theme'), 'dark');
  prefs.fitToScreen = false;
  assertEquals(prefs.fitToScreen, false);
});

Deno.test('unrecognised stored values fall back to the default', () => {
  const prefs = new Preferences(new MemoryStore({ 'v22.legendLayout': 'left', 'v23.theme': 'sepia' }));
  assertEquals(prefs.legendLayout, LegendLayout.Right);
  assertEquals(prefs.theme, null);
});

Deno.test('a throwing store reads defaults and drops writes', () => {
  const broken = {
    getItem(): string | null { throw new Error('SecurityError'); },
    setItem(): void { throw new Error('SecurityError'); },
    removeItem(): void { throw new Error('SecurityError'); },
  };
  const prefs = new Preferences(broken);
  prefs.fitToScreen = true; // must not throw
  assertEquals(prefs.fitToScreen, false);
  assertEquals(prefs.legendLayout, LegendLayout.Right);
});
