import { EditorTheme } from './EditorTheme.ts';
import type { Preferences } from './Preferences.ts';

// Light or dark mode. The theme is applied as `body.lightmode`, which
// re-binds the stylesheet's colour variables. Until the user picks a theme
// the editor follows the OS; after that their choice is saved.
export class ThemeController {
  private current: EditorTheme;

  constructor(private readonly prefs: Preferences) {
    this.current = prefs.theme ?? ThemeController.osDefault();
  }

  // Light if the OS asks for light, else dark.
  static osDefault(): EditorTheme {
    try {
      if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return EditorTheme.Light;
    } catch { /* matchMedia unavailable */ }
    return EditorTheme.Dark;
  }

  get theme(): EditorTheme {
    return this.current;
  }

  apply(): void {
    document.body.classList.toggle('lightmode', this.current === EditorTheme.Light);
  }

  // Switch to the other theme, save it and apply it.
  toggle(): void {
    this.current = this.current === EditorTheme.Dark ? EditorTheme.Light : EditorTheme.Dark;
    this.prefs.theme = this.current;
    this.apply();
  }
}
