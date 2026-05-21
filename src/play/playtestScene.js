import { Scene } from './core/scene.js';
import { rectsOverlap } from './core/aabb.js';
import { COLOURS, TILE } from './constants.js';
import { toWorld } from './adapter.js';
import { meetsPickupRequirement } from '../playSettings.js';
import { draw as editorDraw, drawFallback } from '../renderer.js';
import { roleOf } from '../level.js';

/**
 * Pure helper (v14): rebuild a parsed grid with selected cells blanked
 * to background. Used to remove the player's spawn cell and any
 * collected coins from the static layer before handing the grid to the
 * editor renderer. The original grid is not mutated.
 *
 * @param {string[]} grid          rows from `parse()` (equal-width strings)
 * @param {{r:number,c:number}[]} clearedCells cells to set to '.'
 * @returns {string[]} a fresh array of rows
 */
export function buildViewGrid(grid, clearedCells) {
  const rows = grid.map((row) => row.split(''));
  for (const cell of clearedCells) {
    const { r, c } = cell ?? {};
    if (rows[r] && rows[r][c] != null) rows[r][c] = '.';
  }
  return rows.map((cells) => cells.join(''));
}

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
    // v18: per-level pickup requirement (`# pickup-required:`); default
    // 'all' preserves the pre-v18 win rule.
    this.requiredPickups = this.parsed?.meta?.pickupRequired ?? 'all';
    this.phase = 'play'; // 'play' | 'won' | 'dead'

    // v14: locate the player's spawn cell + glyph char in the parsed
    // grid. The editor renderer needs the cell blanked so it doesn't
    // draw the player at its static spawn position underneath the
    // moving overlay; the overlay uses the char to pick its sprite
    // via tileset.entityFor(...). Fallback to 'P' if the legend lacks
    // a role:player char (the launch gate would normally reject that).
    this.spawnRC = null;
    this.playerChar = 'P';
    const grid = this.parsed.grid;
    for (let r = 0; r < grid.length && !this.spawnRC; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (roleOf(this.legend, grid[r][c]) === 'player') {
          this.spawnRC = { r, c };
          this.playerChar = grid[r][c];
          break;
        }
      }
    }
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

    // v18: honour the level's # pickup-required: directive
    // ("all" | 0 | N). Default behaviour ("all") is identical to v17.
    if (meetsPickupRequirement(this.score, this.total, this.requiredPickups)) {
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
    // v14: static layer rendered by the editor renderer over a "view
    // grid" — the parsed grid with the player's spawn cell and any
    // collected coin cells blanked to background. This makes playtest
    // and editor preview pixel-equivalent for the static layer (the
    // editor renderer is now the single source of pixel truth).
    const cleared = [];
    if (this.spawnRC) cleared.push(this.spawnRC);
    for (const coin of this.coins) {
      if (!coin.collected) continue;
      cleared.push({
        r: Math.round(coin.y / TILE),
        c: Math.round(coin.x / TILE),
      });
    }
    const viewGrid = buildViewGrid(this.parsed.grid, cleared);
    // v16: capture wall-clock `now` once per frame and forward to the
    // renderer + the player overlay. Animated sprites (frames > 1 with
    // no explicit frame) cycle from this clock; static sprites ignore
    // it. The editor preview path omits `now` and stays deterministic.
    const now = performance.now();
    editorDraw(
      ctx,
      { grid: viewGrid, meta: this.parsed.meta, rows: this.parsed.rows },
      this.tileset,
      TILE,
      now,
    );

    // Overlay the moving player at its physics-driven float position
    // (rounded to integer pixels so the sprite is pixel-aligned during
    // motion). Tileset sprite if authored; the editor's exact same
    // shape fallback otherwise — keeping Dirt's blue disc identical
    // between preview and playtest.
    const spec = this.tileset?.entityFor?.(this.playerChar, now);
    const px = Math.round(this.player.x);
    const py = Math.round(this.player.y);
    if (spec) {
      ctx.drawImage(spec.image, spec.sx, spec.sy, spec.sw, spec.sh, px, py, TILE, TILE);
    } else {
      drawFallback(ctx, this.playerChar, px, py, TILE);
    }

    // HUD
    ctx.fillStyle = COLOURS.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 16px monospace';
    const hud =
      this.phase === 'play' &&
      meetsPickupRequirement(this.score, this.total, this.requiredPickups)
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
