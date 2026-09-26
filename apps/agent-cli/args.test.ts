import { assertEquals, assertThrows } from '@std/assert';
import { DEFAULT_BUDGET_MS, DEFAULT_CONTENT_DIR, parseArgs, UsageError } from './args.ts';
import type { Command } from './args.ts';

const defaults = { budgetMs: DEFAULT_BUDGET_MS, json: false, contentDir: DEFAULT_CONTENT_DIR };

Deno.test('a single level argument solves that level with the defaults', () => {
  assertEquals(parseArgs(['tutorial']), { kind: 'solve', level: 'tutorial', ...defaults });
});

Deno.test('flags may come before or after the level', () => {
  const expected: Command = { kind: 'solve', level: 'a.txt', ...defaults, json: true, budgetMs: 8000 };
  assertEquals(parseArgs(['--json', 'a.txt', '--budget', '8000']), expected);
  assertEquals(parseArgs(['--budget=8000', 'a.txt', '--json']), expected);
});

Deno.test('--content overrides the content folder', () => {
  const expected: Command = { kind: 'solve', level: 'x', ...defaults, contentDir: 'fixtures' };
  assertEquals(parseArgs(['x', '--content', 'fixtures']), expected);
});

Deno.test('--all takes no level', () => {
  assertEquals(parseArgs(['--all']), { kind: 'all', ...defaults });
  assertThrows(() => parseArgs(['--all', 'tutorial']), UsageError, 'does not take a level');
});

Deno.test('--help wins over everything else, even bad input', () => {
  assertEquals(parseArgs(['--help']), { kind: 'help' });
  assertEquals(parseArgs(['-h', '--all', 'extra']), { kind: 'help' });
});

Deno.test('usage errors', () => {
  assertThrows(() => parseArgs([]), UsageError, 'missing <level>');
  assertThrows(() => parseArgs(['a', 'b']), UsageError, 'expected one level');
  assertThrows(() => parseArgs(['--verbose', 'a']), UsageError, "unknown option '--verbose'");
  assertThrows(() => parseArgs(['a', '--budget']), UsageError, '--budget needs a value');
  assertThrows(() => parseArgs(['a', '--json=yes']), UsageError, 'does not take a value');
});

Deno.test('--budget must be a positive whole number', () => {
  for (const bad of ['0', '-5', '2.5', 'soon']) {
    assertThrows(() => parseArgs(['a', `--budget=${bad}`]), UsageError, 'positive whole number');
  }
});
