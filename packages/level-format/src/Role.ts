// What a glyph *does* in a level. Everything downstream (the validator,
// the engine's world builder, the renderer's decoration passes) keys
// behaviour off a glyph's role, never off the literal glyph character,
// so a tileset can rebind or add glyphs freely.
//
// The values are the exact strings used in tile_lookup.json, so saved
// data never changes.
export enum Role {
  Background = 'background',
  Terrain = 'terrain',
  Player = 'player',
  Exit = 'exit',
  Hazard = 'hazard',
  Pickup = 'pickup',
  // Drawn under the entities; inert in play.
  Decoration = 'decoration',
  // Drawn over the entities; inert in play.
  Foreground = 'foreground',
  // Never written in data: the role a legend gives a glyph whose declared
  // role it does not recognise. Every rule ignores it, so a typo in a
  // tileset makes a glyph inert rather than breaking the level.
  Unknown = 'unknown',
}

// The roles a tileset may declare — every role except `Unknown`.
export const KNOWN_ROLES: ReadonlySet<Role> = new Set<Role>(
  Object.values(Role).filter((r) => r !== Role.Unknown),
);

// Type guard: is `value` (typically unvalidated JSON) a declarable role?
export function isKnownRole(value: unknown): value is Role {
  return typeof value === 'string' && KNOWN_ROLES.has(value as Role);
}
