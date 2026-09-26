// Where the CLI writes: reports to `out`, errors to `err`. Commands depend
// on this interface, so tests pass collectors instead of the console.
export interface Output {
  out(text: string): void;
  err(text: string): void;
}
