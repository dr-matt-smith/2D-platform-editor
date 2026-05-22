import { Scene } from './core/scene.js';
import { rectsOverlap } from './core/aabb.js';
import { COLOURS, TILE } from './constants.js';
import { toWorld } from './adapter.js';
import { meetsPickupRequirement } from '../playSettings.js';
import { centerCamera, computeCamera } from '../playtestCamera.js';
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

  /**
   * v21: override the player's pose + velocity. Used only by the v21
   * per-action simulator (src/agent/simAction.js) which mints a
   * PlaytestScene then forces the player to a specific (xPx, yPx,
   * vx, vy, onGround) start state before stepping through one
   * action's recording. The live launcher path does NOT call this;
   * v17/v18/v19/v20 playtest behaviour is byte-unchanged.
   *
   * v9 §7 invariant note: this method lives on PlaytestScene, which
   * is v9-original glue (not vendored upstream); vendored Player
   * (which owns the x/y/vx/vy/onGround fields) is untouched.
   */
  setPlayerState({ x, y, vx = 0, vy = 0, onGround = false }) {
    if (!this.player) return;
    this.player.x = x;
    this.player.y = y;
    this.player.vx = vx;
    this.player.vy = vy;
    this.player.onGround = onGround;
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

    // v19: viewport dims (pixels). Null → fit mode (no scrolling; the
    // v18 behaviour). Non-null → camera scrolls a window across the
    // world.
    const vp = this.parsed?.meta?.viewport;
    this.viewport = vp ? { w: vp.w * TILE, h: vp.h * TILE } : null;

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

    // v19: initialise the camera to centre the player at spawn (clamped
    // to world edges). Fit mode keeps camX/Y at 0 — the renderer's
    // camera-null path ignores them entirely.
    this.camX = 0;
    this.camY = 0;
    if (this.viewport) {
      const c = centerCamera(this.#playerCenter(), this.viewport, {
        w: this.worldW,
        h: this.worldH,
      });
      this.camX = c.camX;
      this.camY = c.camY;
    }
  }

  /** Player centre in world pixels — small helper so camera math is one-liner. */
  #playerCenter() {
    return { x: this.player.x + this.player.w / 2, y: this.player.y + this.player.h / 2 };
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

    // v19: dead-zone camera follow (no-op in fit mode — viewport is
    // null, so we skip the math entirely and camX/Y stay at 0).
    if (this.viewport) {
      const c = computeCamera(
        this.#playerCenter(),
        { camX: this.camX, camY: this.camY },
        this.viewport,
        { w: this.worldW, h: this.worldH },
      );
      this.camX = c.camX;
      this.camY = c.camY;
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
    // v19: pass the camera to the renderer when in windowed mode. The
    // renderer's camera-null path stays byte-identical for fit-mode
    // levels (the v18 + pre-v18 behaviour).
    const camera = this.viewport
      ? {
          camX: this.camX,
          camY: this.camY,
          viewW: this.viewport.w,
          viewH: this.viewport.h,
        }
      : null;
    editorDraw(
      ctx,
      { grid: viewGrid, meta: this.parsed.meta, rows: this.parsed.rows },
      this.tileset,
      TILE,
      now,
      camera,
    );

    // Overlay the moving player at its physics-driven float position
    // (rounded to integer pixels so the sprite is pixel-aligned during
    // motion). Tileset sprite if authored; the editor's exact same
    // shape fallback otherwise — keeping Dirt's blue disc identical
    // between preview and playtest.
    //
    // v19: shift the overlay into viewport coords by subtracting the
    // (rounded) camera origin — matches the renderer's
    // `ctx.translate(-Math.round(camX), -Math.round(camY))`. In fit
    // mode camX/Y are 0, so the math is the v18 path exactly.
    const spec = this.tileset?.entityFor?.(this.playerChar, now);
    const px = Math.round(this.player.x) - Math.round(this.camX);
    const py = Math.round(this.player.y) - Math.round(this.camY);
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
    // v19: banner centres on the canvas (= the viewport in windowed
    // mode, = the world in fit mode), not the world. The HUD + this
    // banner paint AFTER the renderer's `ctx.restore()`, so we're in
    // screen-space already — read dims from the canvas.
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    ctx.fillStyle = 'rgba(10,11,14,0.78)';
    ctx.fillRect(0, cy - 46, W, 92);
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
