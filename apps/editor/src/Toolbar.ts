import { EditorTheme } from './EditorTheme.ts';

// What each toolbar button does; the editor supplies the actions.
export interface ToolbarActions {
  download(): void;
  play(): void;
  playSettings(): void;
  test(): void;
  toggleFit(): void;
  toggleTheme(): void;
  newLevel(): void;
  load(): void;
  restart(): void;
  exit(): void;
}

// The toolbar above the preview (`.pane.right > .status`). Edit-mode
// buttons carry `.edit-only` and Play's Restart / Exit carry `.play-only`;
// the stylesheet shows one set or the other from the body's mode class.
// The Level and Tileset menus sit in it too, but are their own classes.
export class Toolbar {
  constructor(
    private readonly element: HTMLElement,
    private readonly dirty: HTMLElement,
    private readonly fitButton: HTMLButtonElement,
    private readonly themeButton: HTMLButtonElement,
    actions: ToolbarActions,
  ) {
    const bind = (selector: string, action: () => void) =>
      element.querySelector(selector)!.addEventListener('click', action);
    bind('#newBtn', () => actions.newLevel());
    bind('#dlBtn', () => actions.download());
    bind('#loadBtn', () => actions.load());
    bind('#playSettingsBtn', () => actions.playSettings());
    bind('#restartBtn', () => actions.restart());
    bind('#exitBtn', () => actions.exit());
    bind('#playBtn', () => actions.play());
    bind('#fitBtn', () => actions.toggleFit());
    bind('#themeBtn', () => actions.toggleTheme());
    bind('#testBtn', () => actions.test());
  }

  // "● unsaved" while the buffer differs from the saved level.
  showDirty(dirty: boolean): void {
    this.dirty.textContent = dirty ? '● unsaved' : '';
  }

  showFit(on: boolean): void {
    this.fitButton.classList.toggle('active', on);
    this.fitButton.title = on ? 'Fit canvas to screen (currently ON)' : 'Fit canvas to screen (currently OFF)';
  }

  // The title says which theme is on and what a click switches to.
  showTheme(theme: EditorTheme): void {
    this.themeButton.title = theme === EditorTheme.Light
      ? 'Theme: light (click for dark)'
      : 'Theme: dark (click for light)';
  }

  // Hold the toolbar at its current height. Entering Play or Test swaps
  // many edit buttons for a few; if the edit row had wrapped (e.g. when
  // zoomed in) the toolbar would shrink and the canvas jump up.
  pinHeight(): void {
    this.element.style.minHeight = `${Math.ceil(this.element.getBoundingClientRect().height)}px`;
  }

  unpinHeight(): void {
    this.element.style.minHeight = '';
  }
}
