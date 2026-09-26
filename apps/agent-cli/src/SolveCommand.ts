import { AgentCommand } from './AgentCommand.ts';
import { ExitCode } from './ExitCode.ts';
import { ReportStatus } from './ReportStatus.ts';
import type { CommandContext } from './CommandContext.ts';
import type { RunOptions } from './RunOptions.ts';

// `solve <level>`: solve one level (a bundled id or a .txt path) and print
// its report.
export class SolveCommand extends AgentCommand {
  constructor(readonly level: string, options: RunOptions) {
    super(options);
  }

  async execute(context: CommandContext): Promise<ExitCode> {
    const store = this.store(context);
    const level = await store.prepare(await store.resolve(this.level));
    const report = await this.solver().solve(level, this.options.budgetMs);
    context.output.out(this.formatter().report(report));
    return report.status === ReportStatus.Solved ? ExitCode.Solved : ExitCode.Failed;
  }
}
