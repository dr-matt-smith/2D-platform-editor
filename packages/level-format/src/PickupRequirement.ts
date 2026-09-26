// The `# pickup-required:` rule: how many pickups the player must collect
// before touching an exit wins the level. Shared by the editor's Play
// Settings dialog, the engine's win check and the level text setters.

// The rule as stored in `LevelMeta.pickupRequired` and in saved levels:
//   'all' — every pickup (the default)
//   0     — no minimum: touching an exit wins straight away
//   N     — at least N pickups (clamped to the number in the level)
export type PickupRequired = 'all' | number;

export class PickupRequirement {
  // The default rule: every pickup must be collected.
  static readonly ALL = new PickupRequirement('all');

  constructor(readonly required: PickupRequired = 'all') {}

  // Read a directive value: 'all' (any case) or a non-negative integer.
  // Returns null for anything else, so the caller keeps its default.
  static parseValue(value: string): PickupRequired | null {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'all') return 'all';
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    return null;
  }

  // True when collecting `score` of the level's `total` pickups is enough
  // for an exit to win the level.
  isMetBy(score: number, total: number): boolean {
    const required = this.required;
    if (required === 'all') return score >= total;
    // Defensive: a non-finite count (NaN, Infinity) behaves like 'all'.
    if (typeof required !== 'number' || !Number.isFinite(required)) return score >= total;
    if (required <= 0) return true; // 0 (or negative) = no minimum
    // A level with fewer pickups than asked for still wins on "all of them".
    return score >= Math.min(required, total);
  }

  // The text to write after `# pickup-required:`, or null when the rule
  // is the default ('all') or not a whole number >= 0 — in both cases the
  // directive is left out of the level text.
  directiveValue(): string | null {
    const required = this.required;
    if (required === 'all') return null;
    return Number.isInteger(required) && required >= 0 ? String(required) : null;
  }
}
