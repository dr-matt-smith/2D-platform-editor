/** Reports progress: milliseconds used so far, out of the budget. */
export type ProgressListener = (elapsedMs: number, maxRuntimeMs: number) => void;

/**
 * The wall-clock budget for a level test. Between steps the tester calls
 * `tick()`, which reports progress, says whether to carry on, and yields
 * to the event loop so a browser page stays responsive (and a Cancel
 * button can abort).
 */
export class SearchBudget {
  private readonly startTime = Date.now();

  constructor(
    readonly maxRuntimeMs: number,
    private readonly onProgress: ProgressListener = () => {},
    private readonly signal?: AbortSignal,
  ) {}

  /** Milliseconds since the budget was created. */
  get elapsedMs(): number {
    return Date.now() - this.startTime;
  }

  /** Report progress; false if aborted or out of time, else yield and return true. */
  async tick(): Promise<boolean> {
    const elapsed = Date.now() - this.startTime;
    this.onProgress(elapsed, this.maxRuntimeMs);
    if (this.signal?.aborted) return false;
    if (elapsed >= this.maxRuntimeMs) return false;
    await new Promise((r) => setTimeout(r, 0));
    return true;
  }
}
