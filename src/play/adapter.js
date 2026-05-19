// Pure: a designer parsed level → the vendored engine's entity world.
// No DOM, no canvas — unit-tested headless (TDD v9 design §4). The editor's
// glyph alphabet is mapped to engine entities; world units are TILE px,
// identical to the imported engine's own units, so its physics is unchanged.
//
//   #  Filled        → Platform(x,y,TILE,TILE,"ground")  (full-tile solid)
//   P  Player spawn  → Player(x,y)
//   ^  Hazard        → Spike(x,y)   (lethal)
//   o  Pickup        → Coin(x,y)
//   E  Exit          → Goal(x,y)    (v9-original; win = all o, then touch E)
//   .  / space / any other → background (ignored)
//
// Unknown glyphs are ignored (the editor's validator already flags them and
// the launch gate refuses an error-level level), keeping this total + pure.
import { TILE } from './constants.js';
import { Player } from './entities/player.js';
import { Platform } from './entities/platform.js';
import { Coin } from './entities/coin.js';
import { Spike } from './entities/spike.js';
import { Goal } from './entities/goal.js';

/**
 * @param parsed result of level.js `parse()` ({ meta, grid, rows })
 * @param tile   px per cell (default = the engine's TILE)
 * @returns { player, platforms, coins, spikes, goals, worldW, worldH }
 */
export function toWorld(parsed, tile = TILE) {
  const { grid, meta } = parsed;
  const platforms = [];
  const coins = [];
  const spikes = [];
  const goals = [];
  let player = null;

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      const x = c * tile;
      const y = r * tile;
      switch (row[c]) {
        case '#':
          platforms.push(new Platform(x, y, tile, tile, 'ground'));
          break;
        case 'P':
          // Exactly one P is a launch-gate precondition; if a level
          // somehow has more, the last wins (deterministic).
          player = new Player(x, y);
          break;
        case '^':
          spikes.push(new Spike(x, y));
          break;
        case 'o':
          coins.push(new Coin(x, y));
          break;
        case 'E':
          goals.push(new Goal(x, y));
          break;
        default:
          break; // background / unknown → ignored
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
