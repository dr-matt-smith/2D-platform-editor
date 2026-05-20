import { Scene } from './core/scene.js';
import { rectsOverlap } from './core/aabb.js';
import { COLOURS } from './constants.js';
import { toWorld } from './adapter.js';

/**
 * The single playtest scene (TDD v9 §7). v9 does NOT vendor upstream's
 * Title/Game/Win/Lose flow — that was bound to a multi-level manifest,
 * fixed canvas, progression and the logger. Here there is exactly one
 * level (the editor buffer, parsed at launch); win/lose are in-scene
 * banners; `R` restarts from the launch snapshot; `Esc` quits (the
 * launcher owns Escape — `Input` doesn't normalise it).
 *
 * Rules (design §4.1): collect every `o`, then touch an `E` to WIN;
 * touching a `^` or falling below the world is GAME OVER.
 */
export class PlaytestScene extends Scene {
  /**
   * @param game    vendored Game
   * @param parsed  level.js parse() result (the launch snapshot)
   * @param legend  the active tileset legend, used by `toWorld` to map
   *                chars to roles (TDD v11 §7)
   * @param tileset the active tileset object (v14): consumed by the
   *                editor renderer when drawing the static scene, and
   *                by `entityFor(playerChar)` when drawing the moving
   *                player overlay. May be null on an offline fallback;
   *                in that case the renderer + overlay both fall back
   *                to shape colours, matching the editor preview.
   * @param onExit  called when the player chooses to leave (Esc / button)
   */
  constructor(game, parsed, legend, tileset, onExit) {
    super(game);
    this.parsed = parsed;
    this.legend = legend;
    this.tileset = tileset;
    this.onExit = onExit;
  }

  enter() {
    this.restart();
  }

  /** Rebuild fresh entities from the snapshot — deterministic (design §11). */
  restart() {
    const w = toWorld(this.parsed, this.legend);
    this.player = w.player;
    this.platforms = w.platforms;
    this.coins = w.coins;
    this.spikes = w.spikes;
    this.goals = w.goals;
    this.worldW = w.worldW;
    this.worldH = w.worldH;
    this.score = 0;
    this.total = this.coins.length;
    this.phase = 'play'; // 'play' | 'won' | 'dead'
  }

  update(dt) {
    const input = this.game.input;

    if (this.phase !== 'play') {
      if (input.wasPressed('r')) this.restart();
      return;
    }

    this.player.update(dt, this);

    for (const c of this.coins) {
      if (!c.collected && rectsOverlap(this.player, c)) {
        c.collected = true;
        this.score++;
        this.game.assets.play('coin', { volume: 0.4 });
      }
    }

    for (const s of this.spikes) {
      if (rectsOverlap(this.player, s)) {
        this.phase = 'dead';
        return;
      }
    }

    if (this.player.y > this.worldH + 50) {
      this.phase = 'dead';
      return;
    }

    if (this.score === this.total) {
      for (const g of this.goals) {
        if (rectsOverlap(this.player, g)) {
          this.phase = 'won';
          return;
        }
      }
    }

    if (input.wasPressed('r')) this.restart();
  }

  draw(ctx) {
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, this.worldW, this.worldH);

    for (const p of this.platforms) p.draw(ctx);
    for (const g of this.goals) g.draw(ctx);
    for (const c of this.coins) if (!c.collected) c.draw(ctx, this.game.assets);
    for (const s of this.spikes) s.draw(ctx, this.game.assets);
    this.player.draw(ctx, this.game.assets);

    // HUD
    ctx.fillStyle = COLOURS.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 16px monospace';
    const hud =
      this.phase === 'play' && this.score === this.total && this.total >= 0
        ? `coins: ${this.score} / ${this.total}   →  find the exit`
        : `coins: ${this.score} / ${this.total}`;
    ctx.fillText(hud, 8, 8);

    if (this.phase !== 'play') this.#banner(ctx);
  }

  #banner(ctx) {
    const cx = this.worldW / 2;
    const cy = this.worldH / 2;
    ctx.fillStyle = 'rgba(10,11,14,0.78)';
    ctx.fillRect(0, cy - 46, this.worldW, 92);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.phase === 'won' ? COLOURS.accent : COLOURS.text;
    ctx.font = 'bold 34px monospace';
    ctx.fillText(this.phase === 'won' ? 'YOU WIN' : 'GAME OVER', cx, cy - 10);
    ctx.fillStyle = COLOURS.text;
    ctx.font = '15px monospace';
    ctx.fillText('R restart   ·   Esc exit', cx, cy + 22);
  }
}
