# ArgParser

`apps/agent-cli/src/ArgParser.ts` · class

Command-line parsing: `argv` in, a [Command](Command.md) object out. It is pure (no I/O), so every flag combination is unit-testable, and it owns the usage text because that text describes the flags it accepts.

## Relationships
- creates [HelpCommand](HelpCommand.md), [SolveCommand](SolveCommand.md) and [SolveAllCommand](SolveAllCommand.md), filling in [RunOptions](RunOptions.md)
- throws [UsageError](UsageError.md) for a bad command line
- used by [AgentCli](AgentCli.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `DEFAULT_BUDGET_MS` | static readonly | `5000`, the editor's first search budget |
| `DEFAULT_CONTENT_DIR` | static readonly | `'content/data'`, relative to the repo root |
| `USAGE` | static readonly | The `--help` text, with the defaults filled in |
| `parse(argv)` | static method | Parse the arguments (without the program name). `--help` / `-h` wins over everything else |
| `flags`, `values`, `positionals` | private readonly properties | The arguments sorted by `read`: boolean flags, `--flag value` pairs, and the rest |
| `read(argv)` | private method | Sort each argument; accepts `--budget 8000` and `--budget=8000` |
| `command()` | private method | Decide which command the sorted arguments describe |

## Example
```ts
ArgParser.parse(['tutorial', '--json']);   // SolveCommand('tutorial', { json: true, ... })
ArgParser.parse(['--all']);                // SolveAllCommand({ ... })
ArgParser.parse(['-h', 'anything']);       // HelpCommand(ArgParser.USAGE)
ArgParser.parse(['--budget=0', 'x']);      // throws UsageError
```

## Design notes
- **Static factory, private constructor.** `parse` makes a private parser
  object for one command line. Its fields hold the in-progress state, so
  the steps (`read`, `command`, `options`, `budget`) are small methods
  instead of one long function passing maps around.
- **Returns objects, not flags.** The result is a ready-to-run command, so
  no one else has to interpret the flags again. Tests compare against
  `new SolveCommand(...)` directly with `assertEquals`.
- **Constants belong to the concept.** The defaults and usage text are
  `static readonly` members, so `ArgParser.DEFAULT_BUDGET_MS` reads as what
  it is.
