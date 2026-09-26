import { TILE } from './constants.ts';
import type { PhysicsAdapter } from './PhysicsAdapter.ts';

// Checks a PhysicsAdapter at the agent's public boundary. The agent
// discretises levels at its own TILE; an adapter wrapping an engine with
// a different tile size would make every simulated edge land on the wrong
// cell, and plans would silently fail on the live engine. Throwing here
// makes that misconfiguration loud and immediate.
export class AdapterGuard {
  private constructor() {}

  /** Throws unless `adapter` exists and its TILE matches the agent's. */
  static assert(
    adapter: PhysicsAdapter | null | undefined,
    where: string,
  ): asserts adapter is PhysicsAdapter {
    if (!adapter) {
      throw new Error(`${where}: an adapter is required. Pass jsAdapter (from @2d-platform/engine) or another PhysicsAdapter.`);
    }
    if (adapter.TILE !== TILE) {
      throw new Error(
        `${where}: adapter.TILE (${adapter.TILE}) does not match the agent's TILE (${TILE}). ` +
        `The adapter must wrap the same engine physics the agent was built against.`,
      );
    }
  }
}
