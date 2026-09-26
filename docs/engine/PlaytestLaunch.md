# PlaytestLaunch

`packages/engine/src/PlaytestLaunch.ts` · interface

What [Playtest](Playtest.md)`.launch` returns.

## Relationships
- extends [GateResult](GateResult.md)
- `playtest` is a [Playtest](Playtest.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `ok` | property | `false` only when the gate refused the level |
| `reasons` | property | Why it was refused (empty otherwise) |
| `playtest` | property | The running [Playtest](Playtest.md), or `null` if none was started |

| Outcome | `ok` | `reasons` | `playtest` |
|---|---|---|---|
| launched | `true` | `[]` | the playtest |
| refused by the gate | `false` | the blocking issues | `null` |
| one already running | `true` | `[]` | `null` |

## Example
```ts
const r = Playtest.launch(level, legend, tileset, canvas);
if (!r.ok) showProblems(r.reasons);
else if (r.playtest) enterPlayMode(r.playtest);
```

## Design notes
The gate's answer plus the object it produced, so a caller handles refusal
and success from one return value.
