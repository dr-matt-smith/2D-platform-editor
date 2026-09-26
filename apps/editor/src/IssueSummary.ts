// A one-line summary of a level's validation issues, for the editor's
// message bar: the most serious issue, plus "· +N more" if there are
// others. Errors come before warnings; within a severity, the first issue
// in the list wins. Pure — no DOM, no clock — so it is unit-tested directly.

// Any issue-shaped object; every field may be missing (shown as '?').
export interface IssueLike {
  line?: number;
  col?: number;
  severity?: string;
  message?: string;
}

export class IssueSummary {
  // The severity shown when there are no issues.
  static readonly OK = 'ok';
  // Sort rank per severity; anything else sorts after warnings.
  private static readonly RANK: Readonly<Record<string, number>> = { error: 0, warn: 1 };

  // `severity` drives the bar's tint through its `data-severity` attribute.
  constructor(readonly text: string, readonly severity: string) {}

  static of(issues: readonly IssueLike[] | null | undefined): IssueSummary {
    if (!issues || issues.length === 0) return new IssueSummary('OK', IssueSummary.OK);
    // Array.prototype.sort is stable, so equal severities keep their order.
    const sorted = [...issues].sort((a, b) => IssueSummary.rank(a) - IssueSummary.rank(b));
    const first: IssueLike = sorted[0] ?? {};
    const severity = first.severity ?? 'info';
    const head = `${first.line ?? '?'}:${first.col ?? '?'} ${severity} ${first.message ?? ''}`;
    const remaining = issues.length - 1;
    return new IssueSummary(remaining > 0 ? `${head} · +${remaining} more` : head, severity);
  }

  private static rank(issue: IssueLike | undefined): number {
    return IssueSummary.RANK[issue?.severity ?? ''] ?? 2;
  }
}
