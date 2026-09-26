import { ExitCode } from './ExitCode.ts';
import type { Command } from './Command.ts';
import type { CommandContext } from './CommandContext.ts';

// `--help` / `-h`: print the usage text. The text is passed in (ArgParser
// owns it, since it describes the flags ArgParser accepts).
export class HelpCommand implements Command {
  constructor(readonly usage: string) {}

  execute({ output }: CommandContext): Promise<ExitCode> {
    output.out(this.usage);
    return Promise.resolve(ExitCode.Solved);
  }
}
