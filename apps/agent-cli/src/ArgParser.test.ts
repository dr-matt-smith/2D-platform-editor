import { assertEquals, assertInstanceOf, assertThrows } from '@std/assert';
import { ArgParser } from './ArgParser.ts';
import { HelpCommand } from './HelpCommand.ts';
import { SolveAllCommand } from './SolveAllCommand.ts';
import { SolveCommand } from './SolveCommand.ts';
import { UsageError } from './UsageError.ts';
import type { RunOptions } from './RunOptions.ts';

const defaults: RunOptions = {
  budgetMs: ArgParser.DEFAULT_BUDGET_MS,
  json: false,
  contentDir: ArgParser.DEFAULT_CONTENT_DIR,
};
const parse = (...argv: string[]) => ArgParser.parse(argv);

Deno.test('a single level argument solves that level with the defaults', () => {
  assertEquals(parse('tutorial'), new SolveCommand('tutorial', defaults));
});

Deno.test('flags may come before or after the level', () => {
  const expected = new SolveCommand('a.txt', { ...defaults, json: true, budgetMs: 8000 });
  assertEquals(parse('--json', 'a.txt', '--budget', '8000'), expected);
  assertEquals(parse('--budget=8000', 'a.txt', '--json'), expected);
});

Deno.test('--content overrides the content folder', () => {
  assertEquals(parse('x', '--content', 'fixtures'), new SolveCommand('x', { ...defaults, contentDir: 'fixtures' }));
});

Deno.test('--all takes no level', () => {
  assertEquals(parse('--all'), new SolveAllCommand(defaults));
  assertThrows(() => parse('--all', 'tutorial'), UsageError, 'does not take a level');
});

Deno.test('--help wins over everything else, even bad input', () => {
  assertInstanceOf(parse('--help'), HelpCommand);
  assertInstanceOf(parse('-h', '--all', 'extra'), HelpCommand);
  assertEquals(parse('--help'), new HelpCommand(ArgParser.USAGE));
});

Deno.test('usage errors', () => {
  assertThrows(() => parse(), UsageError, 'missing <level>');
  assertThrows(() => parse('a', 'b'), UsageError, 'expected one level');
  assertThrows(() => parse('--verbose', 'a'), UsageError, "unknown option '--verbose'");
  assertThrows(() => parse('a', '--budget'), UsageError, '--budget needs a value');
  assertThrows(() => parse('a', '--json=yes'), UsageError, 'does not take a value');
});

Deno.test('--budget must be a positive whole number', () => {
  for (const bad of ['0', '-5', '2.5', 'soon']) {
    assertThrows(() => parse('a', `--budget=${bad}`), UsageError, 'positive whole number');
  }
});

Deno.test('the usage text shows the defaults', () => {
  assertEquals(ArgParser.USAGE.includes(`(default ${ArgParser.DEFAULT_BUDGET_MS})`), true);
  assertEquals(ArgParser.USAGE.includes(`(default ${ArgParser.DEFAULT_CONTENT_DIR})`), true);
});
