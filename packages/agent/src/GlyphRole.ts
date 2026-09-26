/**
 * The glyph roles the agent cares about. The values are level-format's
 * role strings (the agent cannot import level-format's `Role` enum).
 */
export enum GlyphRole {
  Terrain = 'terrain',
  Hazard = 'hazard',
  Player = 'player',
  Exit = 'exit',
  Pickup = 'pickup',
}
