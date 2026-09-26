import type { CommandContext } from './CommandContext.ts';
import type { ExitCode } from './ExitCode.ts';

// One thing the CLI can do, as parsed from the command line. AgentCli
// runs any command the same way: `execute` it and exit with the result.
export interface Command {
  execute(context: CommandContext): Promise<ExitCode>;
}
