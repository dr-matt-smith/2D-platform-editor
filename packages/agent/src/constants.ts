// The engine physics numbers the agent plans against.
//
// The agent never imports the engine, so it keeps its own copy. They must
// match the engine behind the adapter: `AdapterGuard` checks the adapter's
// TILE against this one before any planning, so a mismatched adapter (say a
// port that shipped a display tile size of 24) fails loudly instead of
// producing edges the live engine never reproduces. SPEED, JUMP_FORCE and
// GRAVITY set the action timings and the jump-reach envelope below.
export const TILE       = 20;
export const SPEED      = 240;
export const JUMP_FORCE = 560;
export const GRAVITY    = 1600;

// The jump-reach envelope: how far one full jump can carry the player.
const JUMP_FULL_TIME = (2 * JUMP_FORCE) / GRAVITY;
const MAX_HORIZ_PX = SPEED * JUMP_FULL_TIME;
const MAX_VERT_PX = (JUMP_FORCE * JUMP_FORCE) / (2 * GRAVITY);

/** Max horizontal jump distance in cells at start height (full arc). */
export const JUMP_MAX_HORIZ_CELLS: number = Math.floor(MAX_HORIZ_PX / TILE);
/** Max vertical jump height in cells, rounded down for safety. */
export const JUMP_MAX_VERT_CELLS: number = Math.floor(MAX_VERT_PX / TILE);
