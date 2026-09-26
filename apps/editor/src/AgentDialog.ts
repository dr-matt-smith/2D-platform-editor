import type {
  LevelTestFailure,
  LevelTestResult,
  LevelTestSuccess,
  Recording,
  Solution,
} from '@2d-platform/agent';
import { AgentDialogMarkup } from './AgentDialogMarkup.ts';
import { ModalDialog } from './ModalDialog.ts';
import type { Preferences } from './Preferences.ts';

// What `onResult` receives: the agent's result, or — when the user focuses
// another solution — a success naming the focused solution.
export type AgentDialogResult = LevelTestFailure | (LevelTestSuccess & { focusedIdx?: number });

// Run the agent with a time budget, reporting progress, until `signal`
// aborts. The editor supplies it (it knows the level and the engine).
export type RunAgent = (
  maxRuntimeMs: number,
  onProgress: (elapsedMs: number, maxRuntimeMs: number) => void,
  signal: AbortSignal,
) => Promise<LevelTestResult>;

export interface AgentDialogOptions {
  runAgent: RunAgent;
  prefs: Preferences;
  onDemo?: (recording: Recording) => void;
  // `budgetMs` is null when the result comes from focusing a solution.
  onResult?: (result: AgentDialogResult, budgetMs: number | null) => void;
  onClose?: () => void;
}

// The Test dialog. It opens straight into a search and moves through three
// states, each drawn by AgentDialogMarkup:
//
//   searching → success   (solutions, Demo, trace; can be minimised)
//             → failure   (why, and "Try 10s / 15s / 20s" to search again)
//
// Closing it (Esc, outside click, Close) aborts a running search.
export class AgentDialog extends ModalDialog {
  static readonly INITIAL_BUDGET_MS = 5000;
  // `data-act` of an escalation button → its budget.
  private static readonly RETRY_BUDGETS: Readonly<Record<string, number>> = {
    try10: 10000,
    try15: 15000,
    try20: 20000,
  };

  private abortController: AbortController | null = null;
  private progressFrame: number | null = null;
  private stopped = false;
  private minimised: boolean;
  private solutions: Solution[] | null = null;
  private focusedIdx = 0;
  private focusedRecording: Recording | undefined;

  constructor(private readonly options: AgentDialogOptions) {
    super();
    this.minimised = options.prefs.dialogMinimised;
  }

  // The first search starts once the dialog is showing; each state then
  // renders itself as the search progresses.
  protected render(): void {}

  protected override opened(): void {
    void this.search(AgentDialog.INITIAL_BUDGET_MS);
  }

  protected dismiss(): void {
    this.close();
  }

  // Stop any search, remove the dialog, and tell the editor.
  protected override close(): void {
    this.stopped = true;
    this.abortController?.abort();
    if (this.progressFrame) cancelAnimationFrame(this.progressFrame);
    super.close();
    this.options.onClose?.();
  }

  // Replace the content and wire its `data-act` buttons.
  private show(html: string): void {
    this.backdrop.innerHTML = html;
    this.backdrop.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => {
      el.addEventListener('click', (e) => {
        // A button inside a row that has its own data-act (Demo inside a
        // solution row) must not trigger the row as well.
        e.stopPropagation();
        this.act(el.dataset.act);
      });
    });
  }

  private act(act: string | undefined): void {
    if (act === 'close') return this.close();
    if (act === 'demo') {
      // Close first, so the canvas is clear for the demo.
      const recording = this.focusedRecording;
      this.close();
      this.options.onDemo?.(recording!);
      return;
    }
    const retryBudget = act ? AgentDialog.RETRY_BUDGETS[act] : undefined;
    if (retryBudget) void this.search(retryBudget);
    if (act?.startsWith('focus-')) this.focus(Number(act.slice('focus-'.length)));
    if (act === 'minimise' || act === 'expand') this.setMinimised(act === 'minimise');
  }

  private setMinimised(minimised: boolean): void {
    this.minimised = minimised;
    this.options.prefs.dialogMinimised = minimised;
    this.applyMinimisedClass();
    if (this.solutions) this.showSolutions();
  }

  // Minimised, the backdrop turns transparent and click-through (in the
  // stylesheet) so the path overlay stays visible.
  private applyMinimisedClass(): void {
    this.backdrop.classList.toggle('dialog-minimised', this.minimised);
  }

  private showSolutions(): void {
    const solutions = this.solutions!;
    this.show(this.minimised
      ? AgentDialogMarkup.minimised(solutions, this.focusedIdx)
      : AgentDialogMarkup.success(solutions, this.focusedIdx));
  }

  // Make solution `idx` the focused one: its path is drawn solid and Demo
  // plays it.
  private focus(idx: number): void {
    const solutions = this.solutions;
    if (!solutions || idx < 0 || idx >= solutions.length) return;
    this.focusedIdx = idx;
    this.focusedRecording = solutions[idx].recording;
    this.options.onResult?.({ ok: true, solution: solutions[idx], solutions, focusedIdx: idx }, null);
    this.show(AgentDialogMarkup.success(solutions, idx));
  }

  // Run the agent for up to `budgetMs`, counting down meanwhile.
  private async search(budgetMs: number): Promise<void> {
    this.abortController = new AbortController();
    let total = budgetMs;
    const startTime = Date.now();

    this.show(AgentDialogMarkup.searching(budgetMs));
    const tick = () => {
      if (this.stopped) return;
      const elapsed = Date.now() - startTime;
      const countdown = this.backdrop.querySelector('.countdown');
      const bar = this.backdrop.querySelector<HTMLProgressElement>('.countdown-bar');
      if (countdown) countdown.textContent = `${(Math.max(0, total - elapsed) / 1000).toFixed(1)}s`;
      if (bar) bar.value = elapsed;
      this.progressFrame = requestAnimationFrame(tick);
    };
    this.progressFrame = requestAnimationFrame(tick);

    const result = await this.options.runAgent(budgetMs, (_elapsed, max) => {
      total = max;
    }, this.abortController.signal);

    if (this.progressFrame) {
      cancelAnimationFrame(this.progressFrame);
      this.progressFrame = null;
    }
    if (this.stopped) return; // closed mid-search

    this.options.onResult?.(result, budgetMs);
    if (result.ok) {
      this.solutions = result.solutions || [result.solution];
      this.focusedIdx = 0;
      this.focusedRecording = this.solutions[0].recording;
      this.applyMinimisedClass();
      this.showSolutions();
    } else {
      this.show(AgentDialogMarkup.failure(result, budgetMs));
    }
  }
}
