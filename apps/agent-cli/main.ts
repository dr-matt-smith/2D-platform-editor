// Headless agent CLI: `deno task solve <level>` or `deno task solve --all`.
// Wires argument parsing, level loading, solving and formatting together
// and maps the outcome to an exit code. See README.md.
import { parseArgs, USAGE, UsageError } from './args.ts';
import type { RunOptions } from './args.ts';
import { InputError, loadBundledLevel, prepareLevel, readManifest, resolveLevel } from './levelSource.ts';
import { solveLevel, summarise } from './solve.ts';
import type { LevelReport } from './solve.ts';
import {
  formatJson,
  formatReport,
  formatSweepHeader,
  formatSweepJson,
  formatSweepRow,
  formatSweepSummary,
} from './format.ts';

export const EXIT_SOLVED = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

/** Where output goes; tests pass collectors instead of the console. */
export interface Output {
  out: (text: string) => void;
  err: (text: string) => void;
}

const consoleOutput: Output = {
  out: (text) => console.log(text),
  err: (text) => console.error(text),
};

/** Run the CLI and return its exit code. */
export async function run(argv: readonly string[], io: Output = consoleOutput): Promise<number> {
  try {
    const command = parseArgs(argv);
    if (command.kind === 'help') {
      io.out(USAGE);
      return EXIT_SOLVED;
    }
    if (command.kind === 'all') return await solveAll(command, io);
    return await solveOne(command.level, command, io);
  } catch (err) {
    if (err instanceof UsageError) {
      io.err(`error: ${err.message}\n\n${USAGE}`);
      return EXIT_USAGE;
    }
    if (err instanceof InputError) {
      io.err(`error: ${err.message}`);
      return EXIT_USAGE;
    }
    throw err;
  }
}

async function solveOne(ref: string, options: RunOptions, io: Output): Promise<number> {
  const source = await resolveLevel(ref, options.contentDir);
  const level = await prepareLevel(source, options.contentDir);
  const report = await solveLevel(level, options);
  io.out(options.json ? formatJson(report) : formatReport(report));
  return report.status === 'solved' ? EXIT_SOLVED : EXIT_FAILED;
}

async function solveAll(options: RunOptions, io: Output): Promise<number> {
  const manifest = await readManifest(options.contentDir);
  const idWidth = Math.max(...manifest.map((entry) => entry.id.length));
  if (!options.json) io.out(formatSweepHeader(idWidth));

  // One level at a time: each gets the whole budget, and rows stream out
  // as they finish.
  const reports: LevelReport[] = [];
  for (const entry of manifest) {
    const level = await prepareLevel(await loadBundledLevel(entry, options.contentDir), options.contentDir);
    const report = await solveLevel(level, options);
    reports.push(report);
    if (!options.json) io.out(formatSweepRow(report, idWidth));
  }

  const summary = summarise(reports);
  io.out(options.json ? formatSweepJson(summary, reports) : `\n${formatSweepSummary(summary)}`);
  return summary.solved === summary.total ? EXIT_SOLVED : EXIT_FAILED;
}

if (import.meta.main) {
  Deno.exit(await run(Deno.args));
}
