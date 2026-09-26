import type { Output } from './Output.ts';

// The real Output: stdout and stderr through the console.
export class ConsoleOutput implements Output {
  out(text: string): void {
    console.log(text);
  }

  err(text: string): void {
    console.error(text);
  }
}
