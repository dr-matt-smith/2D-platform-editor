# LevelValidator

`packages/level-format/src/LevelValidator.ts` · class

Checks a level against a tileset's [Legend](Legend.md) and lists its
problems as [ValidationIssue](ValidationIssue.md)s. The editor shows them in
its problems panel; the engine's playtest gate refuses to launch on any
`Severity.Error`.

## Relationships
- has a [Legend](Legend.md) (constructor dependency, default `Legend.DEFAULT`)
- checks any [LevelData](LevelData.md) — a [Level](Level.md) or a plain object of that shape
- produces [ValidationIssue](ValidationIssue.md)s with a [Severity](Severity.md)
- used by [Level](Level.md)`.validate()`, the engine's `playtestGate`, and the agent CLI

## Members
| Member | Kind | Description |
|---|---|---|
| `new LevelValidator(legend?)` | constructor | The legend to judge glyphs by |
| `validate(level)` | method | Run every rule, in order, and return all issues |
| `undefinedGlyphs`, `playerSpawns`, `exits`, `declaredSize` | private methods | One rule each |

The rules, in the order their issues appear:

| Rule | Severity | Message |
|---|---|---|
| every glyph is in the legend | error | `undefined glyph 'Z'` (at the glyph) |
| exactly one player spawn | error | `no player spawn (expected exactly one)` / `extra player spawn (only one allowed)` (at each extra one) |
| at least one exit | warn | `no exit in level` |
| grid matches `# size:` | error | `declared height H but found N rows` / `row exceeds declared width W (N chars)` |

## Example
```ts
import { Legend, Level, LevelValidator, Severity } from '@2d-platform/level-format';

const validator = new LevelValidator(Legend.DEFAULT);
const issues = validator.validate(Level.parse('P..\n..P'));
// [{ line: 2, col: 3, severity: Severity.Error, message: 'extra player spawn (only one allowed)' },
//  { line: 1, col: 1, severity: Severity.Warn,  message: 'no exit in level' }]
```

## Design notes
- **Dependency injection.** The legend comes in through the constructor, so
  the same validator class serves every tileset, and tests pass a small
  hand-made legend.
- **Depends on an interface.** `validate` takes [LevelData](LevelData.md),
  not `Level`, so the engine can validate whatever level object it holds.
- **One private method per rule.** `validate` reads as the list of rules;
  adding a rule means adding a method and one line.
- **Role-driven.** Rules ask `legend.roleOf(glyph)`, never compare with
  `'P'` or `'E'`, so a tileset that uses `@` for the player validates.
