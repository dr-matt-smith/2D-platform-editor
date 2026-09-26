# Agent CLI

A headless command-line front end for the planning agent
(`@2d-platform/agent`). It answers the same question as the editor's
**Test level** button, "can the agent finish this level?", without a
browser, so levels can be checked from a terminal, a script or CI.

It reads levels and tilesets straight from disk, runs the agent's `LevelTester` with
the engine's `jsAdapter`, and needs only `--allow-read`.

## Usage

Run from the repo root:

```sh
deno task solve tutorial                              # a bundled level, by id
deno task solve content/data/levels/above_ground.txt  # any level file
deno task solve my_level.txt --budget 15000           # search for longer
deno task solve tutorial --json > tutorial.json       # machine-readable report
deno task solve --all                                 # regression sweep of every bundled level
```

`<level>` is treated as a file path if it ends in `.txt` or contains a
slash, and as a bundled level id otherwise (looked up in
`content/data/levels/manifest.json`).

If the level declares `# tileset: <id>`, its glyph legend is built from
`content/data/tilesets/<id>/tile_lookup.json`, as in the editor. An
unknown tileset falls back to the default legend with a warning.

The level is validated first. If it has errors (no spawn, undefined
glyphs, ...) they are reported and the agent is not run.

### Example output

```
$ deno task solve tutorial
Level:    tutorial  (content/data/levels/tutorial.txt)
Tileset:  Dirt_Platformer_Tiles, 24x10
Solvable: yes, 1 distinct solution found in 59ms (budget 5.0s)

#  frames  game time  steps  walks  jumps  drops  score  attempt
1      83      1.38s      8      5      3      0      4        1
```

The columns are the agent's `SolutionStats`: `frames` is the frame on
which the replay reached the exit (the engine runs at 60 frames per
second, giving `game time`), `steps` counts planned actions (`walks`,
`jumps` and `drops`), `score` is the in-game score at the finish and
`attempt` is the plan/simulate iteration that produced the solution.

```
$ deno task solve --all
level          result    solutions  best frames  jumps  time
tutorial       solved            1           83      3  51ms
below_ground   solved            1          218      4  135ms
above_ground   solved            1          185      3  39ms
above_ground2  solved            1          105      2  16ms
simple         solved            1          106      0  15ms

Summary: 5/5 solved in 256ms
```

## Options

| Flag | Meaning |
|---|---|
| `--all` | Solve every level in the manifest, one row each, then a summary |
| `--budget <ms>` | Search time budget per level. Default 5000, the editor's first budget |
| `--json` | Print a single JSON object instead of text |
| `--content <dir>` | Content folder holding `levels/` and `tilesets/`. Default `content/data` |
| `-h`, `--help` | Show usage |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Solved (with `--all`: every level solved) |
| 1 | Not solved, or the level is invalid (with `--all`: at least one level) |
| 2 | Usage or input error: bad flags, unknown level id, missing file |

Errors go to stderr; reports go to stdout.

## JSON shape

One level (`deno task solve <level> --json`) prints a `LevelReport`
(defined in `src/LevelReport.ts`). `status` says which fields are present:

```ts
{
  status: 'solved' | 'unsolved' | 'invalid',
  level: { id: string | null, name, path, tileset, width, height },
  warnings: ValidationIssue[],          // { line, col, severity, message }

  // status 'solved'
  budgetMs, elapsedMs,
  solutions: [{                          // up to 5, fewest frames first
    stats: { steps, walks, jumps, drops, attempts, frame, score },
    recording: [{ frame, key, down }],   // replay with the engine's ScriptedInput
    trace: [{ kind, target: { r, c }, why, frameRange, edgeId }],
    unreachable: [{ r, c, kind }],       // optional goals the solution skipped
  }],

  // status 'unsolved'
  budgetMs, elapsedMs, attempts,
  reasons: string[],                     // human-readable, most important first
  lastSim: { outcome, frame, score, pos: { x, y } } | null,
  unreachable: [{ r, c, kind: 'pickup' | 'exit' }],

  // status 'invalid'
  errors: ValidationIssue[],
}
```

`recording` is exactly what the editor replays, so another tool can feed
it to `jsAdapter.makeScriptedInput(recording)` (or the Python adapter)
to reproduce a run. Grid cells (`r`, `c`) are 0-based; the text output
converts them to 1-based file line and column numbers.

`--all --json` prints `{ summary, levels }`, where `levels` is an array
of the reports above and `summary` is
`{ total, solved, unsolved, invalid, elapsedMs, failed: string[] }`.

## Code layout

`main.ts` is the entry point and composition root: it builds the real
console and file system and runs `AgentCli`. The classes are in `src/`, one
per file, named after the class.

| Class | Role |
|---|---|
| `AgentCli` | Parses argv, executes the command, maps expected errors to exit code 2 |
| `ArgParser` | Parses argv into a `Command` object (pure); owns the usage text |
| `Command`, `AgentCommand` | The command interface, and the abstract base of the commands that run the agent |
| `SolveCommand`, `SolveAllCommand`, `HelpCommand` | `solve <level>`, `solve --all`, `--help` |
| `ContentStore` | Resolves a level id or path, and loads the tileset legend, through a `FileReader` |
| `LevelSolver` | Validates, runs the agent and builds a `LevelReport` (no I/O) |
| `ReportFormatter`, `TextFormatter`, `JsonFormatter` | Turn reports into text or JSON |
| `SweepSummary` | Totals for `--all` |
| `Output`, `FileReader` (+ `ConsoleOutput`, `DenoFileReader`) | The injected I/O, and its real implementations |
| `ExitCode`, `ReportStatus` | Enums: 0/1/2; `solved`/`unsolved`/`invalid` |
| `testdata/` | A tiny content folder used by the unit tests |

Tests sit beside each class (`*.test.ts`) and run with `deno task test`.
Class-by-class documentation, with a class diagram, is in
[docs/agent-cli](../../docs/agent-cli/README.md).
