// Pure helpers for the v18 Play Settings popup + the playtest's
// pickup-required win gate. No DOM; unit-tested under `node --test`.
//
// `required` semantics (mirrors the `# pickup-required:` directive
// parsed by level.js into `meta.pickupRequired`):
//   - `'all'`  : every pickup must be collected before touching exit
//   - `0`      : no minimum — touching exit wins regardless
//   - `N`      : at least N pickups collected (clamped to `total`)

/**
 * Decide whether the player has met the pickup requirement and is
 * eligible to win by touching the exit. Pure.
 *
 * @param {number} score    pickups collected so far
 * @param {number} total    total pickups in the level
 * @param {'all'|number} required  default 'all' (v17 behaviour)
 * @returns {boolean}
 */
export function meetsPickupRequirement(score, total, required = 'all') {
  if (required === 'all') return score >= total;
  if (typeof required !== 'number' || !Number.isFinite(required)) return score >= total;
  if (required <= 0) return true; // 0 (or negative — defensive) = no minimum
  // Clamp: a level with fewer pickups than declared still wins on "all of them".
  const effective = Math.min(required, total);
  return score >= effective;
}
