// Pure helper (TDD v17 §4.2): condense a list of validator issues
// into a single-line summary for the editor's bottom message bar.
//
// Returns `{ text, severity }` so the caller can drive both the
// rendered string and the bar's tint colour (via a `data-severity`
// attribute or class). Severity priority for the head issue is
// error > warn > anything else (stable within severity, so the FIRST
// error wins over later errors of the same kind).
//
// No DOM, no clock, no side effects — `node --test` runs it directly.

const SEVERITY_ORDER = { error: 0, warn: 1 };

export function summariseIssues(issues) {
  if (!issues || issues.length === 0) {
    return { text: 'OK', severity: 'ok' };
  }
  // Stable sort by severity priority — Array.prototype.sort has been
  // stable in every modern engine since ECMAScript 2019.
  const sorted = [...issues].sort(
    (a, b) =>
      (SEVERITY_ORDER[a?.severity] ?? 2) - (SEVERITY_ORDER[b?.severity] ?? 2),
  );
  const first = sorted[0] ?? {};
  const line = first.line ?? '?';
  const col = first.col ?? '?';
  const sev = first.severity ?? 'info';
  const msg = first.message ?? '';
  const head = `${line}:${col} ${sev} ${msg}`;
  const remaining = issues.length - 1;
  const text = remaining > 0 ? `${head} · +${remaining} more` : head;
  return { text, severity: sev };
}
