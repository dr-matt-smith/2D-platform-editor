# PlaytestGate

`packages/engine/src/PlaytestGate.ts` · class

Decides whether a level can be playtested, and if not, why.

## Relationships
- has a level-format `Legend`; uses level-format's `LevelValidator`
- returns a [GateResult](GateResult.md)
- used by [Playtest](Playtest.md)`.launch`

## Members
| Member | Kind | Description |
|---|---|---|
| `new PlaytestGate(legend?)` | constructor | `legend` defaults to `Legend.DEFAULT` |
| `check(level)` | method | A [GateResult](GateResult.md): blocked by any validation *error*, or by having no exit |

## Example
```ts
const result = new PlaytestGate(legend).check(Level.parse(text));
if (!result.ok) showProblems(result.reasons);
```

## Design notes
- **Reuse, then add one rule.** It runs the editor's own
  `LevelValidator` and keeps only error-severity issues, then adds one
  rule: the editor merely *warns* about a missing exit (a level can be a
  work in progress), but a playtest could never be won without one.
- **Same shape as the validator.** Constructed with a legend, then asked
  about a level — like `new LevelValidator(legend).validate(level)`.
- **Roles, not characters.** The exit is found by its role, so a tileset
  that rebinds it still works.
