import { PickupRequirement, Role } from '@2d-platform/level-format';
import { LevelRenderer } from '@2d-platform/render';
import { COLOURS, TILE } from './constants.ts';
import { GamePhase } from './GamePhase.ts';
import { Key } from './Key.ts';
import { PlaytestCamera } from './PlaytestCamera.ts';
import { Scene } from './Scene.ts';
import { ScriptedInput } from './ScriptedInput.ts';
import { Sound } from './Sound.ts';
import { World } from './World.ts';
import type { GridPosition, Legend, LevelData } from '@2d-platform/level-format';
import type { RenderTileset } from '@2d-platform/render';
import type { Coin } from './Coin.ts';
import type { Player, PlayerStateOverride } from './Player.ts';
import type { SceneHost } from './SceneHost.ts';

// The one scene of a playtest: a single level, played until it is won or
// lost. Collect enough pickups (the level's `# pickup-required:` rule,
// default all), then touch an exit to win; touching a hazard or falling
// out of the world is game over. Win and game over are banners over the
// frozen level; R restarts from the level as launched. Esc is handled by
// the page that launched the playtest, not here.
//
// Drawing goes through the shared `LevelRenderer`, so the playtest looks
// exactly like the editor preview; the moving player is drawn on top.
//
// The same class runs headless for the agent (see `JsPhysicsAdapter`).
// The agent's physics contract reads and writes `phase`, `score`,
// `simFrame`, `simTime`, `player` and `coins`, so those are public.
export class PlaytestScene extends Scene {
  // Spawn settle: at most this many gravity-only frames.
  private static readonly SETTLE_FRAMES = 30;
  // Falling this far below the world's bottom edge is game over.
  private static readonly FALL_MARGIN = 50;

  phase: GamePhase = GamePhase.Play;
  score = 0;
  // Scripted-input clock: the next recording frame to apply, and the
  // seconds of play so far (see `tickScriptedInput`).
  simFrame = 0;
  simTime = 0;

  private readonly level: LevelData;
  private readonly legend: Legend;
  private readonly renderer: LevelRenderer;
  // Everything below is (re)built by `restart()`, which `enter()` calls.
  private world!: World;
  private rule!: PickupRequirement;
  private camera: PlaytestCamera | null = null;
  private spawn: GridPosition | null = null;
  private playerGlyph = 'P';

  // `tileset` may be null (offline): the renderer then draws every glyph
  // as its fallback shape, just like the editor preview.
  constructor(game: SceneHost, level: LevelData, legend: Legend, tileset: RenderTileset | null) {
    super(game);
    this.level = level;
    this.legend = legend;
    this.renderer = new LevelRenderer(tileset, TILE);
  }

  // A copy of `grid` with the given cells set to background ('.'). The
  // playtest hides the player's spawn cell and collected pickups this way
  // before handing the grid to the renderer. Cells outside the grid are
  // ignored; the original grid is never changed.
  static buildViewGrid(grid: readonly string[], cleared: readonly GridPosition[]): string[] {
    const rows = grid.map((line) => line.split(''));
    for (const { row, col } of cleared) {
      if (rows[row] && rows[row][col] != null) rows[row][col] = '.';
    }
    return rows.map((cells) => cells.join(''));
  }

  // The player. A level without a player cell never passes the playtest
  // gate, so the scene treats the player as always present.
  get player(): Player {
    return this.world.player!;
  }

  get coins(): Coin[] {
    return this.world.coins;
  }

  // How many pickups the level has.
  get total(): number {
    return this.world.coins.length;
  }

  override enter(): void {
    this.restart();
  }

  // Start again from the level as launched: fresh entities, score 0,
  // camera on the player, then let the player settle onto the ground.
  restart(): void {
    this.world = World.fromLevel(this.level, this.legend);
    this.score = 0;
    this.rule = new PickupRequirement(this.level.meta.pickupRequired ?? 'all');
    this.phase = GamePhase.Play;
    this.findSpawn();

    // A `# viewport:` level scrolls a camera over the world; otherwise the
    // whole world fits the canvas and there is no camera. The camera
    // starts centred on the spawn, so the first frame doesn't jump.
    const vp = this.level.meta.viewport;
    this.camera = vp ? new PlaytestCamera({ w: vp.w * TILE, h: vp.h * TILE }, this.world.size) : null;
    this.camera?.centreOn(this.player.centre);

    this.settleSpawnFall();

    // Rewind the scripted-input clock *after* settling, so frame 0 of a
    // recording is the moment the player stands on the ground.
    this.simFrame = 0;
    this.simTime = 0;
  }

  // Force the player's pose and velocity. Only the agent calls this, to
  // start a simulated action from an exact state.
  setPlayerState(state: PlayerStateOverride): void {
    this.world.player?.setState(state);
  }

  update(dt: number): void {
    this.tickScriptedInput(dt);
    const input = this.game.input;

    if (this.phase !== GamePhase.Play) {
      if (input.wasPressed(Key.R)) this.restart();
      return;
    }

    this.player.update(dt, { input, solids: this.world.platforms });

    // The order of these checks is part of the physics contract: a pickup
    // and a hazard touched on the same frame both count, pickup first.
    for (const c of this.world.coins) {
      if (!c.collected && this.player.overlaps(c)) {
        c.collect();
        this.score++;
        this.game.sounds.play(Sound.Coin, { volume: 0.4 });
      }
    }

    for (const s of this.world.spikes) {
      if (this.player.overlaps(s)) {
        this.phase = GamePhase.Dead;
        return;
      }
    }

    if (this.player.y > this.world.height + PlaytestScene.FALL_MARGIN) {
      this.phase = GamePhase.Dead;
      return;
    }

    if (this.rule.isMetBy(this.score, this.total)) {
      for (const g of this.world.goals) {
        if (this.player.overlaps(g)) {
          this.phase = GamePhase.Won;
          return;
        }
      }
    }

    this.camera?.follow(this.player.centre);

    if (input.wasPressed(Key.R)) this.restart();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // The static layer: the level with the spawn cell and collected
    // pickups blanked, so the renderer doesn't draw them.
    const cleared: GridPosition[] = [];
    if (this.spawn) cleared.push(this.spawn);
    for (const coin of this.world.coins) {
      if (!coin.collected) continue;
      cleared.push({ row: Math.round(coin.y / TILE), col: Math.round(coin.x / TILE) });
    }
    const viewGrid = PlaytestScene.buildViewGrid(this.level.grid, cleared);

    // One clock reading per frame keeps every animated sprite in step.
    const now = performance.now();
    const exitLocked = !this.rule.isMetBy(this.score, this.total);
    this.renderer.draw(
      ctx,
      { grid: viewGrid, meta: this.level.meta },
      { now, camera: this.camera ? this.camera.view : null, entityState: { exitLocked } },
    );

    // The moving player, at whole pixels: shifted by the rounded camera
    // (as the renderer shifts the level) and down past the HUD band.
    const camX = this.camera ? this.camera.x : 0;
    const camY = this.camera ? this.camera.y : 0;
    const px = Math.round(this.player.x) - Math.round(camX);
    const py = Math.round(this.player.y) - Math.round(camY) + this.renderer.hudHeight;
    this.renderer.drawEntity(ctx, this.playerGlyph, px, py, now);

    this.renderer.drawHud(ctx, this.hudText());
    if (this.phase !== GamePhase.Play) this.drawBanner(ctx);
  }

  private hudText(): string {
    const coins = `coins: ${this.score} / ${this.total}`;
    return this.phase === GamePhase.Play && this.rule.isMetBy(this.score, this.total)
      ? `${coins}   →  find the exit`
      : coins;
  }

  // The win / game-over banner, centred on the canvas (the view, not the
  // world). The renderer has restored the transform, so this is in canvas
  // pixels.
  private drawBanner(ctx: CanvasRenderingContext2D): void {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const won = this.phase === GamePhase.Won;
    ctx.fillStyle = 'rgba(10,11,14,0.78)';
    ctx.fillRect(0, cy - 46, W, 92);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = won ? COLOURS.accent : COLOURS.text;
    ctx.font = 'bold 34px monospace';
    ctx.fillText(won ? 'YOU WIN' : 'GAME OVER', cx, cy - 10);
    ctx.fillStyle = COLOURS.text;
    ctx.font = '15px monospace';
    ctx.fillText('R restart   ·   Esc exit', cx, cy + 22);
  }

  // Find the first player cell. The renderer must not draw the player at
  // its spawn (the moving player is drawn separately, with that cell's
  // glyph). Falls back to 'P' if there is none.
  private findSpawn(): void {
    this.spawn = null;
    this.playerGlyph = 'P';
    const grid = this.level.grid;
    for (let row = 0; row < grid.length && !this.spawn; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (this.legend.roleOf(grid[row][col]) === Role.Player) {
          this.spawn = { row, col };
          this.playerGlyph = grid[row][col];
          break;
        }
      }
    }
  }

  // Let the player fall, with no keys held, until it lands (at most
  // SETTLE_FRAMES frames). Otherwise a spawn placed rows above the floor
  // is still falling when a recording's first keys fire, and a replay
  // drifts from what the agent planned.
  private settleSpawnFall(): void {
    const player = this.world.player;
    if (!player || player.onGround) return;
    const noKeys = new ScriptedInput();
    for (let i = 0; i < PlaytestScene.SETTLE_FRAMES; i++) {
      player.update(1 / 60, { input: noKeys, solids: this.world.platforms });
      if (player.onGround) break;
    }
  }

  // When the input is scripted, apply its recording up to the current
  // frame *before* the player reads the keys (doing it in a separate
  // animation-frame callback raced the game loop and lost frames).
  //
  // Recording frames follow play time, not browser ticks: `simTime`
  // accumulates dt and the recording advances to frame floor(simTime * 60),
  // so a 120 Hz display replays a 60 fps recording at the right speed.
  // Keyboard input has no `advance`, so a human player skips all this.
  private tickScriptedInput(dt: number): void {
    const input = this.game.input;
    if (!input.advance) return;
    this.simTime += dt;
    const target = Math.floor(this.simTime * 60);
    while (this.simFrame < target) {
      input.advance(this.simFrame++);
    }
  }
}
