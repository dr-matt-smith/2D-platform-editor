// The process exit codes the CLI promises (README.md, "Exit codes").
// Numeric, not string, because the values are what the shell sees.
export enum ExitCode {
  // Solved (with --all: every level solved), or --help.
  Solved = 0,
  // Not solved, or the level is invalid (with --all: at least one level).
  Failed = 1,
  // Bad flags, an unknown level id, a missing file.
  Usage = 2,
}
