// Play session: turns level text into a running game on one canvas.
//
// The engine's launcher allows a single playtest at a time, so the session
// owns the current run and always exits it before starting another.
import { buildLegend, parse } from '@2d-platform/level-format';
import { launchPlaytest } from '@2d-platform/engine';
import { loadTileset } from '@2d-platform/render';
import type { Legend, ValidationIssue } from '@2d-platform/level-format';
import type { PlaytestControls } from '@2d-platform/engine';
import type { Tileset } from '@2d-platform/render';

interface LoadedTileset {
  tileset: Tileset;
  legend: Legend;
}

// What happened when we tried to start a level.
export type StartResult =
  | { status: 'playing' }
  | { status: 'invalid'; reasons: ValidationIssue[] } // refused by the launch gate
  | { status: 'cancelled' }; // stopped, or overtaken by a newer start()

// Tilesets are cached by id: most levels share one, so switching between
// them never refetches the images.
const tilesets = new Map<string, Promise<LoadedTileset>>();

function loadTilesetAndLegend(id: string): Promise<LoadedTileset> {
  let loaded = tilesets.get(id);
  if (!loaded) {
    // A missing tileset still resolves (with a null lookup), and
    // buildLegend then falls back to the default legend.
    loaded = loadTileset(id).then((tileset) => ({ tileset, legend: buildLegend(tileset.lookup) }));
    tilesets.set(id, loaded);
  }
  return loaded;
}

export class PlaySession {
  #canvas: HTMLCanvasElement;
  #run: PlaytestControls | null = null;
  // Bumped by every start() and stop(), so a start() that is still loading
  // can tell it has been overtaken and must not launch.
  #generation = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
  }

  get playing(): boolean {
    return this.#run !== null;
  }

  // Load the level text, parse it, load its `# tileset:`, and launch it on
  // the canvas. Any run already in progress is stopped first.
  async start(loadText: () => Promise<string>): Promise<StartResult> {
    this.stop();
    const generation = this.#generation;
    const parsed = parse(await loadText());
    const { tileset, legend } = await loadTilesetAndLegend(parsed.meta.tileset);
    if (generation !== this.#generation) return { status: 'cancelled' };

    const result = launchPlaytest(parsed, legend, tileset, this.#canvas);
    if (!result.ok) return { status: 'invalid', reasons: result.reasons };
    if (!result.exit) {
      // The launcher refused because a playtest is still open. Only this
      // session launches games and it always stops the last one, so this
      // would be a bug.
      throw new Error('A playtest is already running.');
    }

    this.#run = result;
    return { status: 'playing' };
  }

  // Stop the current run (if any) and cancel any start() still loading.
  stop(): void {
    this.#generation++;
    this.#run?.exit();
    this.#run = null;
  }
}
