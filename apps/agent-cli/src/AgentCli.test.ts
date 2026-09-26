// AgentCli against a fake file system: shows that every file the CLI reads
// goes through the injected FileReader.
import { assertEquals, assertStringIncludes } from '@std/assert';
import { AgentCli } from './AgentCli.ts';
import { ExitCode } from './ExitCode.ts';
import type { FileReader } from './FileReader.ts';

const files: FileReader = {
  readTextFile: (path) =>
    path === 'c/levels/manifest.json'
      ? Promise.resolve('[{ "id": "corridor", "name": "corridor", "file": "corridor.txt" }]')
      : path === 'c/levels/corridor.txt'
      ? Promise.resolve('#######\n#P...E#\n#######')
      : Promise.reject(new Deno.errors.NotFound(path)),
};

function cli() {
  const out: string[] = [];
  const err: string[] = [];
  const app = new AgentCli({ output: { out: (t) => out.push(t), err: (t) => err.push(t) }, files });
  return { app, out, err };
}

Deno.test('AgentCli solves a level read through the injected files', async () => {
  const { app, out } = cli();
  assertEquals(await app.run(['corridor', '--content', 'c']), ExitCode.Solved);
  assertStringIncludes(out.join('\n'), 'Level:    corridor  (c/levels/corridor.txt)');
});

Deno.test('AgentCli reports usage and input errors on stderr with exit code 2', async () => {
  const usage = cli();
  assertEquals(await usage.app.run(['--frobnicate']), ExitCode.Usage);
  assertStringIncludes(usage.err[0], "error: unknown option '--frobnicate'\n\nUsage:");

  const input = cli();
  assertEquals(await input.app.run(['nope', '--content', 'c']), ExitCode.Usage);
  assertEquals(input.err, ["error: no bundled level with id 'nope' (available: corridor)"]);
});
