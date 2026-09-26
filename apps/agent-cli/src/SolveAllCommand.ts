import { AgentCommand } from './AgentCommand.ts';
import { ExitCode } from './ExitCode.ts';
import { SweepSummary } from './SweepSummary.ts';
import type { CommandContext } from './CommandContext.ts';
import type { LevelReport } from './LevelReport.ts';
import type { RunOptions } from './RunOptions.ts';

// `solve --all`: solve every bundled level in manifest order, then print a
// summary. Fails if any level is not solved (a regression sweep).
export class SolveAllCommand extends AgentCommand {
  constructor(options: RunOptions) {
    super(options);
  }

  async execute(context: CommandContext): Promise<ExitCode> {
    const { output } = context;
    const store = this.store(context);
    const solver = this.solver();
    const formatter = this.formatter();

    const manifest = await store.readManifest();
    const idWidth = Math.max(...manifest.map((entry) => entry.id.length));
    // Text prints a table as it goes; JSON prints nothing until the end.
    const header = formatter.sweepHeader(idWidth);
    if (header !== null) output.out(header);

    // One level at a time: each gets the whole budget, and rows stream out
    // as they finish.
    const reports: LevelReport[] = [];
    for (const entry of manifest) {
      const level = await store.prepare(await store.loadBundled(entry));
      const report = await solver.solve(level, this.options.budgetMs);
      reports.push(report);
      const row = formatter.sweepRow(report, idWidth);
      if (row !== null) output.out(row);
    }

    const summary = SweepSummary.of(reports);
    output.out(formatter.sweepSummary(summary, reports));
    return summary.allSolved ? ExitCode.Solved : ExitCode.Failed;
  }
}
