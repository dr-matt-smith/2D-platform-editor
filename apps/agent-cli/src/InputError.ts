// A missing or unreadable input (level file, manifest). AgentCli prints the
// message and exits with ExitCode.Usage.
export class InputError extends Error {
  override name = 'InputError';
}
