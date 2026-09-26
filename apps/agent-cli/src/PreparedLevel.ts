import type { Legend, Level } from '@2d-platform/level-format';
import type { LevelFile } from './LevelFile.ts';

// A level ready to solve: parsed, with its tileset's legend.
export interface PreparedLevel extends LevelFile {
  parsed: Level;
  legend: Legend;
  // Set when the declared tileset could not be used (the default legend
  // stands in for it).
  tilesetWarning: string | null;
}
