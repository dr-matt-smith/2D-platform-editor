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
  // v23 M5: minimised state — when true, the dialog renders as a
  // floating bar at the top of the canvas-wrap and the backdrop
  // turns transparent + click-through so the path overlay stays
  // visible behind. Persisted across runs.
  let minimised = readMinimisedPref();

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
      // unobscured for the demo to play. Use the FOCUSED solution's
      // recording (defaults to solutions[0] but the user may have
      // clicked a different row).
      const recording = backdrop._lastRecording;
      close();
      onDemo?.(recording);
      return;
    }
    if (act === 'try10' || act === 'try15' || act === 'try20') {
      const budget = { try10: 10000, try15: 15000, try20: 20000 }[act];
      void startAgent(budget);
    }
    // v22: focus a specific solution row.
    if (act?.startsWith('focus-')) {
      const idx = Number(act.slice('focus-'.length));
      focusSolution(idx);
    }
    // v23 M5: toggle minimised vs full view.
    if (act === 'minimise' || act === 'expand') {
      minimised = act === 'minimise';
      writeMinimisedPref(minimised);
      applyMinimisedClass();
      if (currentSolutions) {
        render(minimised
          ? renderMinimised(currentSolutions, focusedIdx)
          : renderSuccess(currentSolutions, focusedIdx));
      }
    }
  }

  function applyMinimisedClass() {
    backdrop.classList.toggle('dialog-minimised', minimised);
  }

  let focusedIdx = 0;
  let currentSolutions = null;

  function focusSolution(idx) {
    if (!currentSolutions || idx < 0 || idx >= currentSolutions.length) return;
    focusedIdx = idx;
    backdrop._lastRecording = currentSolutions[idx].recording;
    onResult?.({ ok: true, solution: currentSolutions[idx], solutions: currentSolutions, focusedIdx: idx }, null);
    // Re-render with the new focused row highlighted + new trace.
    render(renderSuccess(currentSolutions, idx));
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
      // v22: result has `.solutions` (array). Focus the first.
      currentSolutions = result.solutions || [result.solution];
      focusedIdx = 0;
      backdrop._lastRecording = currentSolutions[0].recording;
      // v23 M5: honour persisted minimised choice on first paint.
      applyMinimisedClass();
      render(minimised
        ? renderMinimised(currentSolutions, 0)
        : renderSuccess(currentSolutions, 0));
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

function renderSuccess(solutions, focusedIdx = 0) {
  // v22 accepts an array; v20/v21 callers passing a single solution
  // are wrapped into a one-element list for back-compat.
  const list = Array.isArray(solutions) ? solutions : [solutions];
  const focused = list[focusedIdx] || list[0];

  const solutionRows = list.map((sol, i) => {
    const s = sol.stats;
    const isFocused = i === focusedIdx;
    const replans = s.attempts > 1
      ? `<span class="stat-pill">${s.attempts - 1} replan${s.attempts > 2 ? 's' : ''}</span>`
      : '';
    return `
      <div class="solution-row${isFocused ? ' focused' : ''}" data-act="focus-${i}">
        <div class="solution-stats">
          <strong>Solution ${i + 1}</strong>
          <span class="stat-pill">${s.steps} step${s.steps === 1 ? '' : 's'}</span>
          <span class="stat-pill">${s.jumps} jump${s.jumps === 1 ? '' : 's'}</span>
          <span class="stat-pill">${s.score} pickup${s.score === 1 ? '' : 's'}</span>
          ${replans}
        </div>
        ${isFocused
          ? '<button class="cf-btn primary" data-act="demo">▶ Demo this route</button>'
          : '<button class="cf-btn" data-act="focus-' + i + '">Focus</button>'}
      </div>`;
  }).join('');

  const traceItems = focused.plan.trace
    .map((e) => `<li><span class="trace-frame">${e.frameRange[0]}–${e.frameRange[1]}</span> ${escapeHtml(e.why)}</li>`)
    .join('');
  const headline = list.length > 1
    ? `✓ Level completable — ${list.length} solutions`
    : '✓ Level completable';

  return `
    <div class="modal confirm agent-dialog" role="dialog" aria-modal="true" aria-label="Agent test results">
      <header class="agent-header">
        <span class="badge ok">${headline}</span>
        <button class="agent-min-btn" data-act="minimise" title="Minimise — keep the path overlay visible">—</button>
      </header>
      ${solutionRows}
      <details class="trace-section" open>
        <summary>Trace — Solution ${focusedIdx + 1} (${focused.plan.trace.length} actions)</summary>
        <ol class="trace-list">${traceItems}</ol>
      </details>
      <div class="cf-actions">
        <button class="cf-btn" data-act="close">Close</button>
      </div>
    </div>`;
}

/* v23 M5: minimised renderer — a thin floating bar pinned to the
   top of the canvas-wrap (CSS positions it absolutely). Shows just
   the focused solution's headline stats + Demo + Expand + Close.
   The backdrop turns transparent in minimised mode (CSS) so the
   path overlay behind is visible. */
function renderMinimised(solutions, focusedIdx = 0) {
  const list = Array.isArray(solutions) ? solutions : [solutions];
  const focused = list[focusedIdx] || list[0];
  const s = focused.stats;
  const headline = list.length > 1
    ? `✓ ${list.length} solutions`
    : '✓ Completable';
  return `
    <div class="minimised-solutions" role="dialog" aria-label="Agent results (minimised)">
      <span class="badge ok">${headline}</span>
      <span class="min-sep">·</span>
      <span class="stat-pill">S${focusedIdx + 1}</span>
      <span class="stat-pill">${s.steps} step${s.steps === 1 ? '' : 's'}</span>
      <span class="stat-pill">${s.jumps} jump${s.jumps === 1 ? '' : 's'}</span>
      <span class="stat-pill">${s.score} pickup${s.score === 1 ? '' : 's'}</span>
      <button class="cf-btn primary" data-act="demo" title="Demo this route">▶ Demo</button>
      <button class="cf-btn" data-act="expand" title="Restore full dialog">↕ Expand</button>
      <button class="cf-btn" data-act="close" title="Close">×</button>
    </div>`;
}

// localStorage persistence — module-scoped so it survives across
// openAgentDialog calls. Read on construction; write on toggle.
function readMinimisedPref() {
  try { return localStorage.getItem('v23.dialogMinimised') === 'true'; }
  catch { return false; }
}
function writeMinimisedPref(value) {
  try { localStorage.setItem('v23.dialogMinimised', String(value)); }
  catch { /* localStorage unavailable */ }
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
