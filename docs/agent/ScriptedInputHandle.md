# ScriptedInputHandle

`packages/agent/src/InputSource.ts` · interface

An [InputSource](InputSource.md) that replays a recording — what [PhysicsAdapter](PhysicsAdapter.md)`.makeScriptedInput` returns.

## Relationships
- extends [InputSource](InputSource.md) (with `advance` required)
- the engine's `ScriptedInput` satisfies it

## Members
| Member | Kind | Description |
|---|---|---|
| `advance(frame)` | method | Apply the recording's events up to `frame`; re-advancing to the same frame does nothing |
| (inherited) |  | `isDown`, `wasPressed`, `endFrame` |

## Example
```ts
const input = adapter.makeScriptedInput(recording);
for (let f = 0; f < 60; f++) { input.advance(f); scene.update(1 / 60); }
```

## Design notes
Narrowing an optional member to a required one in a sub-interface lets the simulators call `advance` without checking for it.
