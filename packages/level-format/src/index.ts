// @2d-platform/level-format — what a level *is*: the text format, the
// glyph legend and each glyph's role, validation, and the pickup rule.
// Pure data and logic: no DOM, no I/O. Every other package builds on this.
export { Level } from './Level.ts';
export { LevelText } from './LevelText.ts';
export { Legend } from './Legend.ts';
export { LevelValidator } from './LevelValidator.ts';
export { PickupRequirement } from './PickupRequirement.ts';
export { Rect } from './Rect.ts';
export { isKnownRole, KNOWN_ROLES, Role } from './Role.ts';
export { Severity } from './Severity.ts';
export { Theme } from './Theme.ts';
export type { Dimensions, GridPosition, LevelData, LevelMeta, LevelRow } from './LevelData.ts';
export type { GlyphDef, GlyphLookup } from './GlyphLookup.ts';
export type { LegendEntry, LegendRecord } from './LegendEntry.ts';
export type { PickupRequired } from './PickupRequirement.ts';
export type { ValidationIssue } from './ValidationIssue.ts';
