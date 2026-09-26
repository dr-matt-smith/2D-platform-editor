import { LevelTester } from '@2d-platform/agent';
import { jsAdapter } from '@2d-platform/engine';
import { Level } from '@2d-platform/level-format';
import type { ActiveTileset } from './ActiveTileset.ts';
import { AgentDialog } from './AgentDialog.ts';
import type { AgentDialogResult } from './AgentDialog.ts';
import type { PlayModeController } from './PlayModeController.ts';
import type { Preferences } from './Preferences.ts';
import type { PreviewPane } from './PreviewPane.ts';
import type { Toolbar } from './Toolbar.ts';

// The Test button: ask the planning agent whether the level can be
// solved, show its answer in an AgentDialog, draw the solution paths on
// the preview's overlay, and hand a chosen solution to Play as a Demo.
//
// This is where the editor joins the agent to the engine: the agent never
// imports the engine, so it is given the engine's physics (`jsAdapter`)
// here. While the dialog is open the body has `testmode`, which hides
// the legend.
export class AgentController {
  constructor(
    private readonly text: () => string,
    private readonly tilesets: ActiveTileset,
    private readonly preview: PreviewPane,
    private readonly toolbar: Toolbar,
    private readonly playMode: PlayModeController,
    private readonly prefs: Preferences,
  ) {}

  // Test the level as it is now.
  open(): void {
    const level = Level.parse(this.text());
    this.toolbar.pinHeight();
    document.body.classList.add('testmode');
    // Re-fit after the layout has taken the class (the legend is hidden).
    requestAnimationFrame(() => this.preview.applyFit());
    new AgentDialog({
      prefs: this.prefs,
      // The legend and tileset are read at each run, so a retry uses the
      // current ones.
      runAgent: (maxRuntimeMs, onProgress, signal) =>
        LevelTester.create(jsAdapter).test(
          level,
          this.tilesets.legend.toRecord(),
          this.tilesets.tileset,
          { maxRuntimeMs, onProgress, signal },
        ),
      onResult: (result) => this.showPaths(result),
      onDemo: (recording) => this.playMode.start(recording),
      onClose: () => {
        document.body.classList.remove('testmode');
        this.toolbar.unpinHeight();
        requestAnimationFrame(() => this.preview.applyFit()); // the legend is back
        this.preview.clearOverlay();
      },
    }).open();
  }

  // Draw the solutions' paths (all of them, the focused one solid), or
  // clear them after a failure.
  private showPaths(result: AgentDialogResult): void {
    this.preview.clearOverlay();
    if (!result.ok) return;
    const solutions = result.solutions || [result.solution];
    const overlay = this.preview.solutionOverlay();
    if (solutions.length > 1) overlay.paintAll(solutions, result.focusedIdx ?? 0);
    else overlay.paint(result.solution);
  }
}
