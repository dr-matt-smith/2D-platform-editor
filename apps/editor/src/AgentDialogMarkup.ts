import { GoalKind, SimOutcome } from '@2d-platform/agent';
import type { LevelTestFailure, Solution } from '@2d-platform/agent';
import { escapeHtml } from './escapeHtml.ts';

// The HTML for each state of the agent dialog. Kept apart from
// AgentDialog (which handles events and timing) because it is pure: data
// in, markup out — so every state is unit-tested without a page.
// Buttons carry a `data-act` the dialog dispatches on.
export class AgentDialogMarkup {
  // Longer searches offered after a failure, in ms.
  static readonly ESCALATION_BUDGETS_MS: readonly number[] = [10000, 15000, 20000];

  // While searching: a countdown and progress bar the dialog updates.
  static searching(budgetMs: number): string {
    const secs = (budgetMs / 1000).toFixed(1);
    return `
    <div class="modal confirm agent-dialog" role="dialog" aria-modal="true" aria-label="Agent searching">
      <header class="agent-header">
        <span class="badge searching">⏳ Searching for a solution…</span>
      </header>
      <p class="cf-msg">The agent has up to ${secs} seconds to find a path.</p>
      <output class="countdown">${secs}s</output>
      <progress class="countdown-bar" value="0" max="${budgetMs}"></progress>
      <div class="cf-actions">
        <button class="cf-btn" data-act="close">Cancel</button>
      </div>
    </div>`;
  }

  // Solved: a row per solution (the focused one with Demo), and the
  // focused solution's step-by-step trace.
  static success(solutions: Solution[], focusedIdx = 0): string {
    const focused = solutions[focusedIdx] || solutions[0];
    const rows = solutions.map((solution, i) => {
      const s = solution.stats;
      const isFocused = i === focusedIdx;
      const replans = s.attempts > 1
        ? `<span class="stat-pill">${s.attempts - 1} replan${s.attempts > 2 ? 's' : ''}</span>`
        : '';
      return `
      <div class="solution-row${isFocused ? ' focused' : ''}" data-act="focus-${i}">
        <div class="solution-stats">
          <strong>Solution ${i + 1}</strong>
          <span class="stat-pill">${AgentDialogMarkup.count(s.steps, 'step')}</span>
          <span class="stat-pill">${AgentDialogMarkup.count(s.jumps, 'jump')}</span>
          <span class="stat-pill">${AgentDialogMarkup.count(s.score, 'pickup')}</span>
          ${replans}
        </div>
        ${isFocused
          ? '<button class="cf-btn primary" data-act="demo">▶ Demo this route</button>'
          : '<button class="cf-btn" data-act="focus-' + i + '">Focus</button>'}
      </div>`;
    }).join('');

    const trace = focused.plan.trace
      .map((e) => `<li><span class="trace-frame">${e.frameRange[0]}–${e.frameRange[1]}</span> ${escapeHtml(e.why)}</li>`)
      .join('');
    const headline = solutions.length > 1
      ? `✓ Level completable — ${solutions.length} solutions`
      : '✓ Level completable';

    return `
    <div class="modal confirm agent-dialog" role="dialog" aria-modal="true" aria-label="Agent test results">
      <header class="agent-header">
        <span class="badge ok">${headline}</span>
        <button class="agent-min-btn" data-act="minimise" title="Minimise — keep the path overlay visible">—</button>
      </header>
      ${rows}
      <details class="trace-section" open>
        <summary>Trace — Solution ${focusedIdx + 1} (${focused.plan.trace.length} actions)</summary>
        <ol class="trace-list">${trace}</ol>
      </details>
      <div class="cf-actions">
        <button class="cf-btn" data-act="close">Close</button>
      </div>
    </div>`;
  }

  // Solved, minimised: a thin bar over the preview (positioned by the
  // stylesheet) with the focused solution's stats, so its path stays
  // visible behind.
  static minimised(solutions: Solution[], focusedIdx = 0): string {
    const focused = solutions[focusedIdx] || solutions[0];
    const s = focused.stats;
    const headline = solutions.length > 1 ? `✓ ${solutions.length} solutions` : '✓ Completable';
    return `
    <div class="minimised-solutions" role="dialog" aria-label="Agent results (minimised)">
      <span class="badge ok">${headline}</span>
      <span class="min-sep">·</span>
      <span class="stat-pill">S${focusedIdx + 1}</span>
      <span class="stat-pill">${AgentDialogMarkup.count(s.steps, 'step')}</span>
      <span class="stat-pill">${AgentDialogMarkup.count(s.jumps, 'jump')}</span>
      <span class="stat-pill">${AgentDialogMarkup.count(s.score, 'pickup')}</span>
      <button class="cf-btn primary" data-act="demo" title="Demo this route">▶ Demo</button>
      <button class="cf-btn" data-act="expand" title="Restore full dialog">↕ Expand</button>
      <button class="cf-btn" data-act="close" title="Close">×</button>
    </div>`;
  }

  // Not solved within `budgetMs`: why, and buttons for longer searches.
  static failure(result: LevelTestFailure, budgetMs: number): string {
    const secs = (budgetMs / 1000).toFixed(0);
    const longer = AgentDialogMarkup.ESCALATION_BUDGETS_MS.filter((b) => b > budgetMs);
    const escalation = longer.length
      ? `
      <div class="escalation-row">
        <p class="cf-msg" style="margin: 0; flex: 1;">Try a longer search?</p>
        ${longer.map((b) => `<button class="cf-btn" data-act="try${b / 1000}">Try ${b / 1000}s</button>`).join('')}
      </div>`
      : '';
    return `
    <div class="modal confirm agent-dialog" role="dialog" aria-modal="true" aria-label="Agent test results">
      <header class="agent-header">
        <span class="badge fail">✗ No solution within ${secs}s</span>
      </header>
      <p class="cf-msg">${AgentDialogMarkup.failureReason(result)}</p>
      ${escalation}
      <div class="cf-actions">
        <button class="cf-btn primary" data-act="close">Close</button>
      </div>
    </div>`;
  }

  // One sentence on why the search failed (may contain markup).
  static failureReason(result: LevelTestFailure): string {
    const { lastPlan, lastSim } = result;
    if (lastPlan.unreachable.some((u) => u.kind === GoalKind.Exit)) {
      return "Exit unreachable from spawn — no valid path within the agent's reach envelope. The level may need a closer pickup chain, a narrower gap, or a stepping-stone platform.";
    }
    if (lastSim?.outcome === SimOutcome.Dead) {
      const { x, y } = lastSim.pos ?? { x: 0, y: 0 };
      return `Last simulation: <code>dead</code> at world (${Math.round(x)}, ${Math.round(y)}) on frame ${lastSim.frame}.`;
    }
    if (lastSim?.outcome === SimOutcome.Timeout) {
      return `Last simulation timed out at frame ${lastSim.frame} — the player didn't reach the exit in 20 simulated seconds.`;
    }
    return 'No solution found within budget.';
  }

  // "1 step", "3 steps".
  private static count(n: number, noun: string): string {
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
  }
}
