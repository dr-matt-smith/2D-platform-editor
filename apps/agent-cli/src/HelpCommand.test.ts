import { assertEquals } from '@std/assert';
import { DenoFileReader } from './DenoFileReader.ts';
import { ExitCode } from './ExitCode.ts';
import { HelpCommand } from './HelpCommand.ts';

Deno.test('HelpCommand prints its usage text to stdout and succeeds', async () => {
  const out: string[] = [];
  const err: string[] = [];
  const output = { out: (t: string) => out.push(t), err: (t: string) => err.push(t) };
  const code = await new HelpCommand('Usage: x').execute({ output, files: new DenoFileReader() });
  assertEquals(code, ExitCode.Solved);
  assertEquals(out, ['Usage: x']);
  assertEquals(err, []);
});
