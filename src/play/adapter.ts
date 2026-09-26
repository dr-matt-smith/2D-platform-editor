// Pure: a designer parsed level → the vendored engine's entity world.
// No DOM, no canvas — unit-tested headless (TDD v9 design §4, v11 design
// §7). The editor's glyph alphabet is mapped to engine entities **by
// role** (TDD v11): the legend's role for each char decides what entity
// (if any) is built. World units are TILE px, identical to the imported
// engine's own units, so its physics is unchanged.
//
//   role 'terrain'    → Platform(x,y,TILE,TILE,'ground')   (full-tile solid)
//   role 'player'     → Player(x,y)                         (exactly one)
//   role 'hazard'     → Spike(x,y)                          (lethal)
//   role 'pickup'     → Coin(x,y)                           (collectable)
//   role 'exit'       → Goal(x,y)                           (win when all pickups in)
//   role 'decoration' → ignored                             (visual only; no collision)
//   role 'background' / 'unknown' / not in legend → ignored
//
// Unknown chars are ignored (the editor's validator already flags them
// and the launch gate refuses an error-level level), keeping this total
// + pure. Multi-char categories (several pickup chars, several hazards)
// are supported transparently — the legend, not the adapter, decides.
import { TILE } from './constants.ts';
import { Player } from './entities/player.ts';
import { Platform } from './entities/platform.ts';
import { Coin } from './entities/coin.ts';
import { Spike } from './entities/spike.ts';
import { Goal } from './entities/goal.ts';
import { DEFAULT_LEGEND, roleOf } from '../level.ts';
import type { ParsedLevel, RoleLegend } from '../level.ts';

// The entity world `toWorld` builds; `player` is null when the grid has
// no role:player cell.
export interface World {
  player: Player | null;
  platforms: Platform[];
  coins: Coin[];
  spikes: Spike[];
  goals: Goal[];
  worldW: number;
  worldH: number;
}

/**
 * @param parsed result of level.js `parse()` ({ meta, grid, rows })
 * @param legend char-keyed legend (TDD v11); defaults to DEFAULT_LEGEND
 * @param tile   px per cell (default = the engine's TILE)
 * @returns { player, platforms, coins, spikes, goals, worldW, worldH }
 */
export function toWorld(
  parsed: ParsedLevel,
  legend: RoleLegend = DEFAULT_LEGEND,
  tile: number = TILE,
): World {
  const { grid, meta } = parsed;
  const platforms: Platform[] = [];
  const coins: Coin[] = [];
  const spikes: Spike[] = [];
  const goals: Goal[] = [];
  let player: Player | null = null;

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      const x = c * tile;
      const y = r * tile;
      switch (roleOf(legend, row[c])) {
        case 'terrain':
          platforms.push(new Platform(x, y, tile, tile, 'ground'));
          break;
        case 'player':
          // Exactly one is a launch-gate precondition; if a level
          // somehow has more, the last wins (deterministic).
          player = new Player(x, y);
          break;
        case 'hazard':
          spikes.push(new Spike(x, y));
          break;
        case 'pickup':
          coins.push(new Coin(x, y));
          break;
        case 'exit':
          goals.push(new Goal(x, y));
          break;
        // decoration / background / unknown / null → ignored
        default:
          break;
      }
    }
  }

  return {
    player,
    platforms,
    coins,
    spikes,
    goals,
    worldW: meta.width * tile,
    worldH: meta.height * tile,
  };
}
