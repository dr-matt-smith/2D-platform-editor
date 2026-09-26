import { ContentStore } from './ContentStore.ts';
import { JsonFormatter } from './JsonFormatter.ts';
import { LevelSolver } from './LevelSolver.ts';
import { TextFormatter } from './TextFormatter.ts';
import type { Command } from './Command.ts';
import type { CommandContext } from './CommandContext.ts';
import type { ExitCode } from './ExitCode.ts';
import type { ReportFormatter } from './ReportFormatter.ts';
import type { RunOptions } from './RunOptions.ts';

// The base of the commands that run the agent. It holds the shared
// RunOptions and builds the collaborators they all need; each subclass
// only says what to solve and what to print.
export abstract class AgentCommand implements Command {
  protected constructor(readonly options: RunOptions) {}

  abstract execute(context: CommandContext): Promise<ExitCode>;

  // Text for people, or JSON with --json. Callers never check which.
  protected formatter(): ReportFormatter {
    return this.options.json ? new JsonFormatter() : new TextFormatter();
  }

  // The content folder named by --content, read through the context's files.
  protected store(context: CommandContext): ContentStore {
    return new ContentStore(this.options.contentDir, context.files);
  }

  protected solver(): LevelSolver {
    return new LevelSolver();
  }
}
