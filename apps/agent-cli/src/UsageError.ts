// A bad command line. AgentCli prints the message and the usage text, and
// exits with ExitCode.Usage.
export class UsageError extends Error {
  override name = 'UsageError';
}
