// v21 agent dialog. Three states managed by the same modal:
//
//   searching  — opens immediately, shows live countdown timer +
//                progress bar while the agent runs.
//   success    — solution found; stats + Demo button + trace.
//   failure    — no solution within budget; diagnostic + escalation
//                buttons (Try 10s / 15s / 20s) + Close.
//
// The caller (main.js) passes a `runAgent(maxRuntimeMs, onProgress,
// signal)` async callback; the dialog drives it through these states.
// Escalation is an internal loop: failure → searching → success or
// failure-with-higher-budget. Esc / backdrop / Close abort via the
// AbortController and resolve as failure.

const INITIAL_BUDGET_MS = 5000;
const ESCALATION_BUDGETS_MS = [10000, 15000, 20000];

/**
 * @param parsed     level.parse() result — for any caller-side use
 * @param runAgent   async (maxRuntimeMs, onProgress, signal) => result
 *                   where result is { ok, solution? | lastPlan, lastSim, attempts }
 * @param onDemo     (recording) => void  — Demo button clicked
 * @param onResult   (result, budgetMs) => void — fires when the agent
 *                   resolves so main.js can render the path overlay
 *                   on success
 * @param onClose    () => void
 */
export function openAgentDialog({ runAgent, onDemo, onResult, onClose }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  document.body.appendChild(backdrop);

  let abortController = null;
  let progressTimer = null;
  let stopRequested = false;

  function close() {
    stopRequested = true;
    if (abortController) abortController.abort();
    if (progressTimer) cancelAnimationFrame(progressTimer);
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    onClose?.();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  function render(html) {
    backdrop.innerHTML = html;
    // Re-wire button handlers (innerHTML wipes them).
    backdrop.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => handleAct(btn.dataset.act));
    });
  }

  function handleAct(act) {
    if (act === 'close') return close();
    if (act === 'demo') {
      // Hand recording to main.js; close the dialog so the canvas is
      // unobscured for the demo to play.
      const recording = backdrop._lastRecording;
      close();
      onDemo?.(recording);
      return;
    }
    if (act === 'try10' || act === 'try15' || act === 'try20') {
      const budget = { try10: 10000, try15: 15000, try20: 20000 }[act];
      void startAgent(budget);
    }
  }

  async function startAgent(budgetMs) {
    abortController = new AbortController();
    let elapsed = 0;
    let total = budgetMs;
    const startTime = Date.now();

    render(renderSearching(budgetMs));
    // Countdown ticker via rAF — refresh ~30 fps.
    function tick() {
      if (stopRequested) return;
      const now = Date.now();
      const liveElapsed = now - startTime;
      const remaining = Math.max(0, total - liveElapsed);
      const countdownEl = backdrop.querySelector('.countdown');
      const progressEl = backdrop.querySelector('.countdown-bar');
      if (countdownEl) countdownEl.textContent = `${(remaining / 1000).toFixed(1)}s`;
      if (progressEl) progressEl.value = liveElapsed;
      progressTimer = requestAnimationFrame(tick);
    }
    progressTimer = requestAnimationFrame(tick);

    const result = await runAgent(budgetMs, (e, t) => {
      elapsed = e;
      total = t;
    }, abortController.signal);

    if (progressTimer) {
      cancelAnimationFrame(progressTimer);
      progressTimer = null;
    }
    if (stopRequested) return; // dialog was closed mid-search

    onResult?.(result, budgetMs);

    if (result.ok) {
      backdrop._lastRecording = result.solution.recording;
      render(renderSuccess(result.solution));
    } else {
      render(renderFailure(result, budgetMs));
    }
  }

  // Kick off the initial search.
  void startAgent(INITIAL_BUDGET_MS);
}

// --- state renderers -----------------------------------------------

function renderSearching(budgetMs) {
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

function renderSuccess(solution) {
  const s = solution.stats;
  const traceItems = solution.plan.trace
    .map((e) => `<li><span class="trace-frame">${e.frameRange[0]}–${e.frameRange[1]}</span> ${escapeHtml(e.why)}</li>`)
    .join('');
  const replans = s.attempts > 1
    ? `<span class="stat-pill">${s.attempts - 1} replan${s.attempts > 2 ? 's' : ''}</span>`
    : '';
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

function renderFailure(result, lastBudgetMs) {
  const lastPlan = result.lastPlan;
  const lastSim = result.lastSim;
  const secs = (lastBudgetMs / 1000).toFixed(0);
  let reason;
  if (lastPlan.unreachable.some((u) => u.kind === 'exit')) {
    reason = "Exit unreachable from spawn — no valid path within the agent's reach envelope. The level may need a closer pickup chain, a narrower gap, or a stepping-stone platform.";
  } else if (lastSim?.outcome === 'dead') {
    const { x, y } = lastSim.pos ?? { x: 0, y: 0 };
    reason = `Last simulation: <code>dead</code> at world (${Math.round(x)}, ${Math.round(y)}) on frame ${lastSim.frame}.`;
  } else if (lastSim?.outcome === 'timeout') {
    reason = `Last simulation timed out at frame ${lastSim.frame} — the player didn't reach the exit in 20 simulated seconds.`;
  } else {
    reason = 'No solution found within budget.';
  }

  // Show escalation buttons only if there's a longer budget to try.
  const nextBudget = ESCALATION_BUDGETS_MS.find((b) => b > lastBudgetMs);
  const escalation = nextBudget
    ? `
      <div class="escalation-row">
        <p class="cf-msg" style="margin: 0; flex: 1;">Try a longer search?</p>
        ${ESCALATION_BUDGETS_MS
          .filter((b) => b > lastBudgetMs)
          .map((b) => `<button class="cf-btn" data-act="try${b / 1000}">Try ${b / 1000}s</button>`)
          .join('')}
      </div>`
    : '';
  return `
    <div class="modal confirm agent-dialog" role="dialog" aria-modal="true" aria-label="Agent test results">
      <header class="agent-header">
        <span class="badge fail">✗ No solution within ${secs}s</span>
      </header>
      <p class="cf-msg">${reason}</p>
      ${escalation}
      <div class="cf-actions">
        <button class="cf-btn primary" data-act="close">Close</button>
      </div>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
