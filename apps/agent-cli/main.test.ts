// End-to-end through run(): argv in, exit code and output out. Uses the
// small fixture content folder so each case stays fast.
import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import { EXIT_FAILED, EXIT_SOLVED, EXIT_USAGE, run } from './main.ts';

const HERE = import.meta.dirname ?? '.';
const FIXTURES = `${HERE}/testdata`;

async function runCli(...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(argv, { out: (t) => out.push(t), err: (t) => err.push(t) });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

Deno.test('--help prints usage and succeeds', async () => {
  const { code, stdout } = await runCli('--help');
  assertEquals(code, EXIT_SOLVED);
  assertStringIncludes(stdout, 'Usage: deno task solve');
});

Deno.test('a bad flag is a usage error on stderr', async () => {
  const { code, stdout, stderr } = await runCli('--nope');
  assertEquals(code, EXIT_USAGE);
  assertEquals(stdout, '');
  assertStringIncludes(stderr, "error: unknown option '--nope'");
});

Deno.test('a missing file is an input error', async () => {
  const { code, stderr } = await runCli('missing.txt', '--content', FIXTURES);
  assertEquals(code, EXIT_USAGE);
  assertEquals(stderr, 'error: level file not found: missing.txt');
});

Deno.test('a solvable level exits 0', async () => {
  const { code, stdout } = await runCli('corridor', '--content', FIXTURES);
  assertEquals(code, EXIT_SOLVED);
  assertStringIncludes(stdout, 'Solvable: yes');
});

Deno.test('an unsolvable level exits 1', async () => {
  const { code, stdout } = await runCli('walled_in', '--content', FIXTURES);
  assertEquals(code, EXIT_FAILED);
  assertStringIncludes(stdout, 'is unreachable from the spawn');
});

Deno.test('--json prints one parseable object', async () => {
  const { code, stdout } = await runCli('corridor', '--json', '--content', FIXTURES);
  assertEquals(code, EXIT_SOLVED);
  const report = JSON.parse(stdout);
  assertEquals(report.status, 'solved');
  assert(report.solutions[0].recording.length > 0);
});

Deno.test('--all sweeps the manifest and fails if any level fails', async () => {
  const { code, stdout } = await runCli('--all', '--content', FIXTURES);
  assertEquals(code, EXIT_FAILED);
  const lines = stdout.split('\n');
  assert(lines[0].startsWith('level'));
  assert(lines[1].startsWith('corridor   solved'));
  assert(lines[2].startsWith('walled_in  UNSOLVED'));
  assertStringIncludes(stdout, 'Summary: 1/2 solved, 1 unsolved');
});

Deno.test('--all --json nests every report under a summary', async () => {
  const { stdout } = await runCli('--all', '--json', '--content', FIXTURES);
  const { summary, levels } = JSON.parse(stdout);
  assertEquals(summary.failed, ['walled_in']);
  assertEquals(levels.length, 2);
});
