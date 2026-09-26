// Report fixtures shared by the formatter tests.
import { GoalKind } from '@2d-platform/agent';
import { ReportStatus } from './ReportStatus.ts';
import type { LevelInfo, SolvedReport, UnsolvedReport } from './LevelReport.ts';

export const LEVEL: LevelInfo = {
  id: 'tutorial',
  name: 'tutorial',
  path: 'content/data/levels/tutorial.txt',
  tileset: 'Dirt_Platformer_Tiles',
  width: 24,
  height: 10,
};

export const SOLVED: SolvedReport = {
  status: ReportStatus.Solved,
  level: LEVEL,
  warnings: [],
  budgetMs: 5000,
  elapsedMs: 59,
  solutions: [
    {
      stats: { steps: 8, walks: 5, jumps: 3, drops: 0, attempts: 1, frame: 83, score: 4 },
      recording: [{ frame: 1, key: 'right', down: true }],
      trace: [],
      unreachable: [],
    },
  ],
};

export const UNSOLVED: UnsolvedReport = {
  status: ReportStatus.Unsolved,
  level: { ...LEVEL, id: 'fred', name: 'fred', path: 'content/data/levels/fred.txt' },
  warnings: [],
  budgetMs: 5000,
  elapsedMs: 1240,
  attempts: 0,
  reasons: ['Exit at line 11, col 2 is unreachable from the spawn.'],
  lastSim: null,
  unreachable: [{ r: 8, c: 1, kind: GoalKind.Exit }],
};
