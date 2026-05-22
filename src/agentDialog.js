// v20 agent dialog. Mirrors the v18 openPlaySettings shape (modal
// backdrop + Esc/backdrop cancel + cf-btn rows). Renders either the
// success state (one solution with stats + Demo button + trace list)
// or the failure state (no solution + diagnostic).
//
// v20 ships one solution per Test run; the markup uses an ordered
// "Solution N" list so v21+ multi-solution slots in without UI rework.

/**
 * @param result    testLevel() return — { ok, solution? | lastPlan, lastSim, attempts }
 * @param onDemo    (recording) => void   — called when the user clicks Demo
 * @param onClose   () => void            — called when the dialog closes
 *                                          (Esc, backdrop click, Close button,
 *                                          or after onDemo handoff)
 */
export function openAgentDialog({ result, onDemo, onClose }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  if (result.ok) {
    backdrop.innerHTML = renderSuccess(result.solution);
  } else {
    backdrop.innerHTML = renderFailure(result);
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    onClose?.();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  backdrop.addEventListener('click', (e) => {
    const btn = e.target.closest('.cf-btn');
    if (btn?.dataset.act === 'demo') {
      // Hand the recording back to main.js; close the dialog so the
      // canvas is unobscured for the demo to play out.
      close();
      onDemo?.(result.solution.recording);
      return;
    }
    if (btn?.dataset.act === 'close' || e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);
}

function renderSuccess(solution) {
  const s = solution.stats;
  const traceItems = solution.plan.trace
    .map((e, i) => `<li><span class="trace-frame">${e.frameRange[0]}–${e.frameRange[1]}</span> ${escapeHtml(e.why)}</li>`)
    .join('');
  const replans = s.attempts > 1 ? `<span class="stat-pill">${s.attempts - 1} replan${s.attempts > 2 ? 's' : ''}</span>` : '';
  return `
    <div class="modal confirm agent-dialog" role="dialog" aria-modal="true" aria-label="Agent test results">
      <header class="agent-header">
        <span class="badge ok">✓ Level completable</span>
      </header>
      <div class="solution-row">
        <div class="solution-stats">
          <strong>Solution 1</strong>
          <span class="stat-pill">${s.steps} step${s.steps === 1 ? '' : 's'}</span>
          <span class="stat-pill">${s.jumps} jump${s.jumps === 1 ? '' : 's'}</span>
          <span class="stat-pill">${s.score} pickup${s.score === 1 ? '' : 's'}</span>
          ${replans}
        </div>
        <button class="cf-btn primary" data-act="demo">▶ Demo this route</button>
      </div>
      <details class="trace-section">
        <summary>Trace (${solution.plan.trace.length} actions)</summary>
        <ol class="trace-list">${traceItems}</ol>
      </details>
      <div class="cf-actions">
        <button class="cf-btn" data-act="close">Close</button>
      </div>
    </div>`;
}

function renderFailure(result) {
  const lastPlan = result.lastPlan;
  const lastSim = result.lastSim;
  let reason;
  if (lastPlan.unreachable.some((u) => u.kind === 'exit')) {
    reason = "Exit unreachable from spawn — no valid path within the planner's jump-reach envelope. The level may need a closer pickup chain, a narrower gap, or a stepping-stone platform.";
  } else if (lastSim?.outcome === 'dead') {
    const { x, y } = lastSim.pos ?? { x: 0, y: 0 };
    reason = `The agent ran out of replan attempts. Last simulation: <code>dead</code> at world (${Math.round(x)}, ${Math.round(y)}) on frame ${lastSim.frame}.`;
  } else if (lastSim?.outcome === 'timeout') {
    reason = `The agent ran out of replan attempts. Last simulation timed out at frame ${lastSim.frame} — the player didn't reach the exit in 10 simulated seconds.`;
  } else {
    reason = 'No solution found within budget.';
  }
  return `
    <div class="modal confirm agent-dialog" role="dialog" aria-modal="true" aria-label="Agent test results">
      <header class="agent-header">
        <span class="badge fail">✗ No solution found</span>
      </header>
      <p class="cf-msg">${reason}</p>
      <div class="cf-actions">
        <button class="cf-btn primary" data-act="close">Close</button>
      </div>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
