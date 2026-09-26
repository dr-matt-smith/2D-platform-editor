import type { Legend } from '@2d-platform/level-format';

// The legend to solve with, plus a warning if the tileset was unusable.
export interface LoadedLegend {
  legend: Legend;
  warning: string | null;
}
