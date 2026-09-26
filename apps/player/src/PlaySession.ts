import { Level } from '@2d-platform/level-format';
import { Playtest } from '@2d-platform/engine';
import { StartStatus } from './StartStatus.ts';
import { TilesetCache } from './TilesetCache.ts';
import type { StartResult } from './StartResult.ts';

// Turns level text into a running game on one canvas.
//
// The engine's launcher allows a single playtest at a time, so the session
// owns the current run and always exits it before starting another.
export class PlaySession {
  private run: Playtest | null = null;
  // Bumped by every start() and stop(), so a start() that is still loading
  // can tell it has been overtaken and must not launch.
  private generation = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly tilesets: TilesetCache = new TilesetCache(),
  ) {}

  // True while a game is running.
  get playing(): boolean {
    return this.run !== null;
  }

  // Load the level text, parse it, load its `# tileset:`, and launch it on
  // the canvas. Any run already in progress is stopped first.
  async start(loadText: () => Promise<string>): Promise<StartResult> {
    this.stop();
    const generation = this.generation;
    const parsed = Level.parse(await loadText());
    const { tileset, legend } = await this.tilesets.get(parsed.meta.tileset);
    if (generation !== this.generation) return { status: StartStatus.Cancelled };

    const result = Playtest.launch(parsed, legend, tileset, this.canvas);
    if (!result.ok) return { status: StartStatus.Invalid, reasons: result.reasons };
    if (!result.playtest) {
      // The launcher refused because a playtest is still open. Only this
      // session launches games and it always stops the last one, so this
      // would be a bug.
      throw new Error('A playtest is already running.');
    }

    this.run = result.playtest;
    return { status: StartStatus.Playing };
  }

  // Stop the current run (if any) and cancel any start() still loading.
  stop(): void {
    this.generation++;
    this.run?.exit();
    this.run = null;
  }
}
