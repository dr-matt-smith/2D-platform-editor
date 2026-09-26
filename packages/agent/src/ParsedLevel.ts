/** `# pickup-required:` — 'all' (the default) or a count (0 = none). */
export type PickupRequired = 'all' | number;

/**
 * The part of a parsed level the agent reads. level-format's `Level` has
 * these fields (and more), so it can be passed straight in.
 */
export interface ParsedLevel {
  grid: readonly string[];
  meta: {
    width: number;
    pickupRequired?: PickupRequired;
  };
}
