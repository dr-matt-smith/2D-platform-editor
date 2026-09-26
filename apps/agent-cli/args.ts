// Command-line parsing: argv in, a typed command out. Pure (no I/O), so
// every flag combination is unit-testable.

/** The editor's first search budget (apps/editor/src/agentDialog.ts). */
export const DEFAULT_BUDGET_MS = 5000;

/** Where the bundled levels and tilesets live, relative to the repo root. */
export const DEFAULT_CONTENT_DIR = 'content/data';

/** Options shared by every command that runs the agent. */
export interface RunOptions {
  budgetMs: number;
  json: boolean;
  contentDir: string;
}

export type Command =
  | { kind: 'help' }
  | ({ kind: 'solve'; level: string } & RunOptions)
  | ({ kind: 'all' } & RunOptions);

/** A bad command line. main.ts prints the message and exits with 2. */
export class UsageError extends Error {
  override name = 'UsageError';
}

export const USAGE = `Usage: deno task solve <level> [options]
       deno task solve --all [options]

Runs the planning agent headlessly on a level and reports whether it is
solvable.

<level> is a path to a .txt level file, or the id of a bundled level
(e.g. tutorial) from <content>/levels/manifest.json.

Options:
  --all             Solve every bundled level and print a summary table
  --budget <ms>     Search time budget per level (default ${DEFAULT_BUDGET_MS})
  --json            Print a JSON report (includes replayable recordings)
  --content <dir>   Content folder (default ${DEFAULT_CONTENT_DIR})
  -h, --help        Show this help

Exit codes: 0 solved, 1 not solved or invalid level, 2 usage or input error.`;

// Flags that take a value, and the boolean ones.
const VALUE_FLAGS = new Set(['--budget', '--content']);
const BOOLEAN_FLAGS = new Set(['--all', '--json', '--help', '-h']);

export function parseArgs(argv: readonly string[]): Command {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('-') || arg === '-') {
      positionals.push(arg);
      continue;
    }
    // Accept both `--budget 8000` and `--budget=8000`.
    const [name, inlineValue] = splitInlineValue(arg);
    if (BOOLEAN_FLAGS.has(name)) {
      if (inlineValue !== undefined) throw new UsageError(`${name} does not take a value`);
      flags.add(name);
    } else if (VALUE_FLAGS.has(name)) {
      const value = inlineValue ?? argv[++i];
      if (value === undefined || value === '') throw new UsageError(`${name} needs a value`);
      values.set(name, value);
    } else {
      throw new UsageError(`unknown option '${arg}'`);
    }
  }

  if (flags.has('--help') || flags.has('-h')) return { kind: 'help' };

  const options: RunOptions = {
    budgetMs: parseBudget(values.get('--budget')),
    json: flags.has('--json'),
    contentDir: values.get('--content') ?? DEFAULT_CONTENT_DIR,
  };

  if (flags.has('--all')) {
    if (positionals.length > 0) throw new UsageError('--all does not take a level argument');
    return { kind: 'all', ...options };
  }
  if (positionals.length === 0) throw new UsageError('missing <level> (a .txt file or a bundled level id)');
  if (positionals.length > 1) throw new UsageError(`expected one level, got ${positionals.length}`);
  return { kind: 'solve', level: positionals[0], ...options };
}

function splitInlineValue(arg: string): [string, string | undefined] {
  const eq = arg.indexOf('=');
  return eq === -1 ? [arg, undefined] : [arg.slice(0, eq), arg.slice(eq + 1)];
}

function parseBudget(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_BUDGET_MS;
  const ms = Number(raw);
  if (!Number.isInteger(ms) || ms <= 0) {
    throw new UsageError(`--budget must be a positive whole number of milliseconds, got '${raw}'`);
  }
  return ms;
}
