import { Shortcut } from './Shortcut.ts';

// The fields of a key event a shortcut depends on.
export interface KeyChord {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

// The editor's Ctrl/Cmd shortcuts. Deciding which command a key press
// means (`commandFor`) is pure and unit-tested; `attach` listens on the
// document and hands each command to the editor.
export class KeyboardShortcuts {
  // The command for `e`, or null if it is not a shortcut.
  static commandFor(e: KeyChord): Shortcut | null {
    if (!(e.metaKey || e.ctrlKey)) return null;
    const k = e.key.toLowerCase();
    if (k === 'o') return Shortcut.OpenLevels;
    if (k === 'enter') return Shortcut.Play;
    if (k === 'z' && !e.shiftKey) return Shortcut.Undo;
    if ((k === 'z' && e.shiftKey) || k === 'y') return Shortcut.Redo;
    return null;
  }

  // Run `handler` for every shortcut pressed in `doc`. The browser's own
  // action for the keys is suppressed (in particular the textarea's native
  // undo, which would get out of step with the editor's).
  static attach(doc: Document, handler: (command: Shortcut) => void): void {
    doc.addEventListener('keydown', (e) => {
      const command = KeyboardShortcuts.commandFor(e);
      if (command === null) return;
      e.preventDefault();
      handler(command);
    });
  }
}
