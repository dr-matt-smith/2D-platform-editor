import { Legend } from './Legend.ts';
import { Role } from './Role.ts';
import { Severity } from './Severity.ts';
import type { GridPosition, LevelData } from './LevelData.ts';
import type { ValidationIssue } from './ValidationIssue.ts';

// Checks a level against a tileset's legend and lists its problems.
// Each rule is a private method; `validate` runs them in order and
// collects their issues. The checks are role-driven (a glyph counts as
// the player because its legend entry says so, not because it is 'P'),
// so a tileset can rebind or add glyphs.
export class LevelValidator {
  constructor(private readonly legend: Legend = Legend.DEFAULT) {}

  validate(level: LevelData): ValidationIssue[] {
    return [
      ...this.undefinedGlyphs(level),
      ...this.playerSpawns(level),
      ...this.exits(level),
      ...this.declaredSize(level),
    ];
  }

  // Rule: every glyph in the grid is in the legend.
  private undefinedGlyphs({ grid, rows }: LevelData): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    grid.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) {
        const g = line[c];
        if (!this.legend.has(g)) {
          issues.push(this.issue(LevelValidator.lineOf(rows, r), c + 1, Severity.Error, `undefined glyph '${g}'`));
        }
      }
    });
    return issues;
  }

  // Rule: exactly one player spawn. Every spawn after the first is
  // flagged, so each one can be found.
  private playerSpawns({ grid, rows }: LevelData): ValidationIssue[] {
    const spawns = this.cellsWithRole(grid, Role.Player);
    if (spawns.length === 0) {
      return [this.issue(1, 1, Severity.Error, 'no player spawn (expected exactly one)')];
    }
    return spawns.slice(1).map(({ col, row }) =>
      this.issue(LevelValidator.lineOf(rows, row), col + 1, Severity.Error, 'extra player spawn (only one allowed)')
    );
  }

  // Rule: at least one exit. Only a warning here, since a level being
  // edited may not have one yet; the playtest gate treats it as an error.
  private exits({ grid }: LevelData): ValidationIssue[] {
    const hasExit = grid.some((line) => [...line].some((ch) => this.legend.roleOf(ch) === Role.Exit));
    return hasExit ? [] : [this.issue(1, 1, Severity.Warn, 'no exit in level')];
  }

  // Rule: a `# size:` directive matches the grid actually written.
  private declaredSize({ meta, rows }: LevelData): ValidationIssue[] {
    const declared = meta.declared;
    if (!declared) return [];
    const issues: ValidationIssue[] = [];
    if (rows.length !== declared.h) {
      issues.push(
        this.issue(1, 1, Severity.Error, `declared height ${declared.h} but found ${rows.length} rows`),
      );
    }
    for (const row of rows) {
      if (row.text.length > declared.w) {
        issues.push(
          this.issue(
            row.line,
            declared.w + 1,
            Severity.Error,
            `row exceeds declared width ${declared.w} (${row.text.length} chars)`,
          ),
        );
      }
    }
    return issues;
  }

  private cellsWithRole(grid: readonly string[], role: Role): GridPosition[] {
    const cells: GridPosition[] = [];
    grid.forEach((line, row) => {
      for (let col = 0; col < line.length; col++) {
        if (this.legend.roleOf(line[col]) === role) cells.push({ col, row });
      }
    });
    return cells;
  }

  private issue(line: number, col: number, severity: Severity, message: string): ValidationIssue {
    return { line, col, severity, message };
  }

  // The file line of grid row `r` (line 1 if the row is unknown).
  private static lineOf(rows: LevelData['rows'], r: number): number {
    return rows[r] ? rows[r].line : 1;
  }
}
