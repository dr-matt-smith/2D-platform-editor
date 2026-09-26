# GamePhase

`packages/engine/src/GamePhase.ts` · enum

The state of a playtest.

## Relationships
- held by [PlaytestScene](PlaytestScene.md)`.phase`; read through [Playtest](Playtest.md)`.phase`
- the agent's `ScenePhase` type is the same three strings

## Members
| Member | Value | Meaning |
|---|---|---|
| `Play` | `'play'` | Running |
| `Won` | `'won'` | Enough pickups and an exit reached (terminal) |
| `Dead` | `'dead'` | Hazard touched or fell out of the world (terminal) |

## Example
```ts
if (playtest.phase === GamePhase.Won) showConfetti();
```

## Design notes
The values are the strings the agent package (which cannot import the
engine) compares against, and they appear in the golden parity vectors, so
they must never change. TypeScript lets a string enum value be used where
the matching string literal type is expected.
