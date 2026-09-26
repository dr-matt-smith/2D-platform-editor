import { Level } from '@2d-platform/level-format';
import type { ValidationIssue } from '@2d-platform/level-format';
import { GamePhase, Playtest } from '@2d-platform/engine';
import type { RecordingEvent } from '@2d-platform/engine';
import type { ActiveTileset } from './ActiveTileset.ts';
import { EditorMode } from './EditorMode.ts';
import type { PreviewPane } from './PreviewPane.ts';
import type { ProblemsPanel } from './ProblemsPanel.ts';
import type { Toolbar } from './Toolbar.ts';

// What Play needs from the rest of the editor.
export interface PlayModeHost {
  // The live level text (unsaved edits included).
  text(): string;
  // The level's issues as the problems bar shows them.
  issues(level: Level): ValidationIssue[];
  // Repaint the editor preview once Play has ended.
  repaint(): void;
}

// Play and Demo: playtest the level in place on the preview canvas, with
// the engine's `Playtest`. Play reads the keyboard; Demo replays an agent
// recording and leaves by itself shortly after the run is won or lost.
// Esc, or the Exit button, returns to editing.
//
// It owns the editor's mode (`EditorMode`): the body gets `playmode`
// (and `demomode`), which the stylesheet uses to swap the toolbar's
// buttons and hide the legend.
export class PlayModeController {
  // How often Demo checks whether the run has ended, and how long it then
  // leaves the win/lose banner up.
  private static readonly DEMO_POLL_MS = 100;
  private static readonly DEMO_EXIT_DELAY_MS = 1500;

  private current: EditorMode = EditorMode.Edit;
  private playtest: Playtest | null = null;
  private demoExitTimer: ReturnType<typeof setTimeout> | null = null;
  // Capture-phase Esc, so it wins over the textarea and menus.
  private readonly onEscape = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    this.exit();
  };

  constructor(
    private readonly preview: PreviewPane,
    private readonly tilesets: ActiveTileset,
    private readonly toolbar: Toolbar,
    private readonly problems: ProblemsPanel,
    private readonly host: PlayModeHost,
  ) {}

  get mode(): EditorMode {
    return this.current;
  }

  // Playtest the live buffer; with a `recording`, run it as a Demo. If the
  // level cannot be played (an error, no exit…) stay in the editor and
  // flash the reasons in the problems bar instead.
  start(recording?: readonly RecordingEvent[]): void {
    if (this.current !== EditorMode.Edit) return; // already playing
    const level = Level.parse(this.host.text());
    const launch = Playtest.launch(
      level,
      this.tilesets.legend,
      this.tilesets.tileset,
      this.preview.canvas,
      recording ? { recording } : {},
    );
    if (!launch.ok) {
      const issues = this.host.issues(level);
      const extra = launch.reasons.filter((r) => !issues.some((i) => i.message === r.message));
      this.problems.show([...issues, ...extra]);
      this.problems.flash();
      return;
    }
    // Pin the toolbar at its edit-mode height before the buttons swap.
    this.toolbar.pinHeight();
    this.current = recording ? EditorMode.Demo : EditorMode.Play;
    this.playtest = launch.playtest;
    // The engine resizes the canvas with its own tile size; pin the CSS
    // size so the canvas keeps its on-screen size.
    this.preview.enterPlay(this.preview.geometry.playPin(level));
    document.body.classList.add('playmode');
    this.preview.applyPlayFit();
    if (this.current === EditorMode.Demo) document.body.classList.add('demomode');
    this.preview.clearOverlay(); // no stray marquee
    document.addEventListener('keydown', this.onEscape, true);
    if (this.current === EditorMode.Demo) this.watchDemo();
  }

  restart(): void {
    this.playtest?.restart();
  }

  // Back to editing: stop the game, restore the page and repaint.
  exit(): void {
    if (this.current === EditorMode.Edit) return;
    if (this.demoExitTimer) {
      clearTimeout(this.demoExitTimer);
      this.demoExitTimer = null;
    }
    this.playtest?.exit();
    this.playtest = null;
    this.current = EditorMode.Edit;
    document.body.classList.remove('playmode');
    document.body.classList.remove('demomode');
    document.removeEventListener('keydown', this.onEscape, true);
    this.toolbar.unpinHeight();
    this.preview.leavePlay();
    this.host.repaint();
    this.preview.applyFit();
  }

  // Leave Demo a moment after the run is won or lost.
  private watchDemo(): void {
    const watcher = setInterval(() => {
      const phase = this.playtest?.phase;
      if (phase === GamePhase.Won || phase === GamePhase.Dead) {
        clearInterval(watcher);
        this.demoExitTimer = setTimeout(() => {
          this.demoExitTimer = null;
          this.exit();
        }, PlayModeController.DEMO_EXIT_DELAY_MS);
      } else if (!this.playtest) {
        clearInterval(watcher);
      }
    }, PlayModeController.DEMO_POLL_MS);
  }
}
