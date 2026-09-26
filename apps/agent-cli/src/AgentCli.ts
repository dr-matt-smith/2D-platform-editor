import { ArgParser } from './ArgParser.ts';
import { ExitCode } from './ExitCode.ts';
import { InputError } from './InputError.ts';
import { UsageError } from './UsageError.ts';
import type { CommandContext } from './CommandContext.ts';

// The CLI as a whole: parse argv into a Command, execute it, and turn the
// two expected kinds of failure into a message and ExitCode.Usage. Any
// other error is a bug and is left to crash with its stack trace.
export class AgentCli {
  constructor(private readonly context: CommandContext) {}

  async run(argv: readonly string[]): Promise<ExitCode> {
    const { output } = this.context;
    try {
      return await ArgParser.parse(argv).execute(this.context);
    } catch (err) {
      if (err instanceof UsageError) {
        output.err(`error: ${err.message}\n\n${ArgParser.USAGE}`);
        return ExitCode.Usage;
      }
      if (err instanceof InputError) {
        output.err(`error: ${err.message}`);
        return ExitCode.Usage;
      }
      throw err;
    }
  }
}
