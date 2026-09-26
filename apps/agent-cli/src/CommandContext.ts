import type { FileReader } from './FileReader.ts';
import type { Output } from './Output.ts';

// The outside world a command may touch, handed to `Command.execute`.
// Everything is an interface, so tests run commands against fakes.
export interface CommandContext {
  output: Output;
  files: FileReader;
}
