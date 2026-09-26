import { EditorTheme } from './EditorTheme.ts';
import type { KeyValueStore } from './KeyValueStore.ts';
import { LegendLayout } from './LegendLayout.ts';

// The editor's saved settings, typed. Each setting is a get/set accessor
// over one storage key, so callers read `prefs.fitToScreen` rather than
// parsing strings. Preferences are best-effort: if storage throws, a read
// gives the default and a write is dropped — the editor never fails over
// a setting.
//
// The keys and the stored strings ('true', 'right', 'light', …) are the
// ones the editor has always written, so saved settings carry over.
export class Preferences {
  private static readonly KEY = {
    legendLayout: 'v22.legendLayout',
    legendCollapsed: 'v22.legendCollapsed',
    fitToScreen: 'v22.fitToScreen',
    theme: 'v23.theme',
    dialogMinimised: 'v23.dialogMinimised',
  } as const;

  constructor(private readonly store: KeyValueStore) {}

  // Legend beside (right) or below (bottom) the preview. Default: right.
  get legendLayout(): LegendLayout {
    return this.readEnum(Preferences.KEY.legendLayout, Object.values(LegendLayout)) ?? LegendLayout.Right;
  }
  set legendLayout(value: LegendLayout) {
    this.write(Preferences.KEY.legendLayout, value);
  }

  // Legend minimised to its toolbar. Default: false.
  get legendCollapsed(): boolean {
    return this.readBool(Preferences.KEY.legendCollapsed, false);
  }
  set legendCollapsed(value: boolean) {
    this.write(Preferences.KEY.legendCollapsed, value);
  }

  // Scale the preview canvas to fill its pane. Default: false.
  get fitToScreen(): boolean {
    return this.readBool(Preferences.KEY.fitToScreen, false);
  }
  set fitToScreen(value: boolean) {
    this.write(Preferences.KEY.fitToScreen, value);
  }

  // The theme the user chose, or null if they never chose one (the
  // editor then follows the OS — see ThemeController).
  get theme(): EditorTheme | null {
    return this.readEnum(Preferences.KEY.theme, Object.values(EditorTheme));
  }
  set theme(value: EditorTheme) {
    this.write(Preferences.KEY.theme, value);
  }

  // The agent dialog's results shown as a thin bar. Default: false.
  get dialogMinimised(): boolean {
    return this.readBool(Preferences.KEY.dialogMinimised, false);
  }
  set dialogMinimised(value: boolean) {
    this.write(Preferences.KEY.dialogMinimised, value);
  }

  private read(key: string): string | null {
    try {
      return this.store.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string | boolean): void {
    try {
      this.store.setItem(key, String(value));
    } catch { /* storage unavailable: keep the setting for this page only */ }
  }

  private readBool(key: string, fallback: boolean): boolean {
    const value = this.read(key);
    return value === null ? fallback : value === 'true';
  }

  // The stored string if it is one of `allowed`, else null.
  private readEnum<T extends string>(key: string, allowed: readonly T[]): T | null {
    const value = this.read(key);
    return allowed.find((a) => a === value) ?? null;
  }
}
