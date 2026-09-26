import { HelpCommand } from './HelpCommand.ts';
import { SolveAllCommand } from './SolveAllCommand.ts';
import { SolveCommand } from './SolveCommand.ts';
import { UsageError } from './UsageError.ts';
import type { Command } from './Command.ts';
import type { RunOptions } from './RunOptions.ts';

// Command-line parsing: argv in, a Command object out. Pure (no I/O), so
// every flag combination is unit-testable.
//
// `ArgParser.parse` makes a private parser that sorts argv into flags,
// values and positionals, then decides which command they describe.
export class ArgParser {
  // The editor's first search budget (apps/editor).
  static readonly DEFAULT_BUDGET_MS = 5000;
  // Where the bundled levels and tilesets live, relative to the repo root.
  static readonly DEFAULT_CONTENT_DIR = 'content/data';

  static readonly USAGE = `Usage: deno task solve <level> [options]
       deno task solve --all [options]

Runs the planning agent headlessly on a level and reports whether it is
solvable.

<level> is a path to a .txt level file, or the id of a bundled level
(e.g. tutorial) from <content>/levels/manifest.json.

Options:
  --all             Solve every bundled level and print a summary table
  --budget <ms>     Search time budget per level (default ${ArgParser.DEFAULT_BUDGET_MS})
  --json            Print a JSON report (includes replayable recordings)
  --content <dir>   Content folder (default ${ArgParser.DEFAULT_CONTENT_DIR})
  -h, --help        Show this help

Exit codes: 0 solved, 1 not solved or invalid level, 2 usage or input error.`;

  // Flags that take a value, and the boolean ones.
  private static readonly VALUE_FLAGS = new Set(['--budget', '--content']);
  private static readonly BOOLEAN_FLAGS = new Set(['--all', '--json', '--help', '-h']);

  private readonly flags = new Set<string>();
  private readonly values = new Map<string, string>();
  private readonly positionals: string[] = [];

  private constructor() {}

  // Parse argv (without the program name). Throws UsageError for a bad
  // command line; --help wins over everything else, even bad input after it.
  static parse(argv: readonly string[]): Command {
    const parser = new ArgParser();
    parser.read(argv);
    return parser.command();
  }

  // Sort each argument into a flag, a flag's value or a positional.
  private read(argv: readonly string[]): void {
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];
      if (!arg.startsWith('-') || arg === '-') {
        this.positionals.push(arg);
        continue;
      }
      // Accept both `--budget 8000` and `--budget=8000`.
      const [name, inlineValue] = ArgParser.splitInlineValue(arg);
      if (ArgParser.BOOLEAN_FLAGS.has(name)) {
        if (inlineValue !== undefined) throw new UsageError(`${name} does not take a value`);
        this.flags.add(name);
      } else if (ArgParser.VALUE_FLAGS.has(name)) {
        const value = inlineValue ?? argv[++i];
        if (value === undefined || value === '') throw new UsageError(`${name} needs a value`);
        this.values.set(name, value);
      } else {
        throw new UsageError(`unknown option '${arg}'`);
      }
    }
  }

  // The command the sorted arguments describe.
  private command(): Command {
    if (this.flags.has('--help') || this.flags.has('-h')) return new HelpCommand(ArgParser.USAGE);

    const options = this.options();
    if (this.flags.has('--all')) {
      if (this.positionals.length > 0) throw new UsageError('--all does not take a level argument');
      return new SolveAllCommand(options);
    }
    if (this.positionals.length === 0) throw new UsageError('missing <level> (a .txt file or a bundled level id)');
    if (this.positionals.length > 1) throw new UsageError(`expected one level, got ${this.positionals.length}`);
    return new SolveCommand(this.positionals[0], options);
  }

  private options(): RunOptions {
    return {
      budgetMs: this.budget(),
      json: this.flags.has('--json'),
      contentDir: this.values.get('--content') ?? ArgParser.DEFAULT_CONTENT_DIR,
    };
  }

  private budget(): number {
    const raw = this.values.get('--budget');
    if (raw === undefined) return ArgParser.DEFAULT_BUDGET_MS;
    const ms = Number(raw);
    if (!Number.isInteger(ms) || ms <= 0) {
      throw new UsageError(`--budget must be a positive whole number of milliseconds, got '${raw}'`);
    }
    return ms;
  }

  private static splitInlineValue(arg: string): [string, string | undefined] {
    const eq = arg.indexOf('=');
    return eq === -1 ? [arg, undefined] : [arg.slice(0, eq), arg.slice(eq + 1)];
  }
}
