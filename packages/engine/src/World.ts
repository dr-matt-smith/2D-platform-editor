import { Legend, Role } from '@2d-platform/level-format';
import { TILE } from './constants.ts';
import { Coin } from './Coin.ts';
import { Goal } from './Goal.ts';
import { Platform } from './Platform.ts';
import { PlatformKind } from './PlatformKind.ts';
import { Player } from './Player.ts';
import { Spike } from './Spike.ts';
import type { LevelData } from '@2d-platform/level-format';
import type { Entity } from './Entity.ts';
import type { Size } from './Size.ts';

// The entities built from a level, in world pixels.
interface WorldContents {
  player: Player | null;
  platforms: Platform[];
  coins: Coin[];
  spikes: Spike[];
  goals: Goal[];
  width: number;
  height: number;
}

// The game world a level becomes: one entity per meaningful cell, kept in
// a list per kind because the rules treat each kind differently.
//
// Each cell's glyph is mapped by its *role* in the legend, never by the
// character itself, so a tileset can rebind glyphs freely:
//
//   terrain → Platform (a full-tile ground block)
//   player  → Player (exactly one; if there are several, the last wins)
//   hazard  → Spike
//   pickup  → Coin
//   exit    → Goal
//   anything else (background, decoration, unknown glyphs) → nothing
//
// Building never fails: unknown glyphs are skipped (the editor's validator
// already reports them, and the playtest gate refuses such a level).
export class World {
  // Null when the level has no player cell.
  readonly player: Player | null;
  // Plain arrays (not `readonly`) because the agent's contract types the
  // scene's `coins` as a mutable array.
  readonly platforms: Platform[];
  readonly coins: Coin[];
  readonly spikes: Spike[];
  readonly goals: Goal[];
  // The size of the whole level in pixels.
  readonly width: number;
  readonly height: number;

  private constructor(contents: WorldContents) {
    this.player = contents.player;
    this.platforms = contents.platforms;
    this.coins = contents.coins;
    this.spikes = contents.spikes;
    this.goals = contents.goals;
    this.width = contents.width;
    this.height = contents.height;
  }

  // Build the world for `level`. `tile` is the size of one cell in world
  // pixels (the engine's `TILE` unless a test asks otherwise).
  static fromLevel(level: LevelData, legend: Legend = Legend.DEFAULT, tile: number = TILE): World {
    const { grid, meta } = level;
    const contents: WorldContents = {
      player: null,
      platforms: [],
      coins: [],
      spikes: [],
      goals: [],
      width: meta.width * tile,
      height: meta.height * tile,
    };

    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let c = 0; c < row.length; c++) {
        const x = c * tile;
        const y = r * tile;
        switch (legend.roleOf(row[c])) {
          case Role.Terrain:
            contents.platforms.push(new Platform(x, y, tile, tile, PlatformKind.Ground));
            break;
          case Role.Player:
            contents.player = new Player(x, y);
            break;
          case Role.Hazard:
            contents.spikes.push(new Spike(x, y));
            break;
          case Role.Pickup:
            contents.coins.push(new Coin(x, y));
            break;
          case Role.Exit:
            contents.goals.push(new Goal(x, y));
            break;
          default:
            break;
        }
      }
    }

    return new World(contents);
  }

  // The world's size as a `{ w, h }`.
  get size(): Size {
    return { w: this.width, h: this.height };
  }

  // Every entity, back to front: platforms, goals, spikes, coins, player.
  get entities(): Entity[] {
    const all: Entity[] = [...this.platforms, ...this.goals, ...this.spikes, ...this.coins];
    if (this.player) all.push(this.player);
    return all;
  }

  // Draw every entity as its simple shape. Each entity draws itself, so
  // this loop needs no idea what kinds exist.
  draw(ctx: CanvasRenderingContext2D): void {
    for (const entity of this.entities) entity.draw(ctx);
  }
}
