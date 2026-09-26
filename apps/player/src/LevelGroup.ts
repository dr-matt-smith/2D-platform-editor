import type { LevelEntry } from './LevelEntry.ts';

// A run of consecutive levels sharing a group (`null` = ungrouped).
export interface LevelGroup {
  group: string | null;
  levels: LevelEntry[];
}
