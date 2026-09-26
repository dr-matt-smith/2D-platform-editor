// Headless agent CLI: `deno task solve <level>` or `deno task solve --all`.
// The composition root: builds the real console and file system, hands
// them to AgentCli, and exits with its code. See README.md.
import { AgentCli } from './src/AgentCli.ts';
import { ConsoleOutput } from './src/ConsoleOutput.ts';
import { DenoFileReader } from './src/DenoFileReader.ts';
import type { ExitCode } from './src/ExitCode.ts';
import type { Output } from './src/Output.ts';

// Run the CLI and return its exit code. Tests pass an Output that collects
// the text instead of printing it.
export function run(argv: readonly string[], io: Output = new ConsoleOutput()): Promise<ExitCode> {
  return new AgentCli({ output: io, files: new DenoFileReader() }).run(argv);
}

if (import.meta.main) {
  Deno.exit(await run(Deno.args));
}
