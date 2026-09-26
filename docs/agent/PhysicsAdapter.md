# PhysicsAdapter

`packages/agent/src/PhysicsAdapter.ts` · interface

The agent's only link to a game engine. Every class that simulates physics is handed one; the engine package implements it (`JsPhysicsAdapter`, shared instance `jsAdapter`), and so does the Python port.

## Relationships
- implemented by the engine's `JsPhysicsAdapter` (`packages/engine/src/JsPhysicsAdapter.ts`)
- makes [SceneHandle](SceneHandle.md)s and [ScriptedInputHandle](ScriptedInputHandle.md)s
- held by [Planner](Planner.md), [ActionSimulator](ActionSimulator.md), [Simulator](Simulator.md), [PerFrameExpander](PerFrameExpander.md); checked by [AdapterGuard](AdapterGuard.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `TILE` | readonly property | The engine's tile size in px; must equal the agent's (20) |
| `makeScene(parsed, legend, tileset)` | method | A fresh, already-entered scene of the level. `tileset` is opaque to the agent |
| `makeScriptedInput(recording)` | method | A scripted input source that replays the recording |

## Example
```ts
// A toy adapter (see packages/agent/examples/headless.ts for a full one).
const stubAdapter: PhysicsAdapter = {
  TILE: 20,
  makeScene: (parsed) => makeStubScene(parsed),
  makeScriptedInput: (recording) => makeStubInput(recording),
};
PlannerFactory.create(stubAdapter).plan(level, null);
```

## Design notes
- **Adapter pattern and dependency inversion.** The agent (the policy)
  declares the interface it needs; the engine (the detail) implements it,
  importing only this type. The agent never depends on an engine, so the
  same planner drives the JS engine, the Python port, or a test stub.
- **A small surface.** Two factory methods and a constant. Everything the
  agent does to a scene goes through [SceneHandle](SceneHandle.md).
- **Why TILE is checked.** See [AdapterGuard](AdapterGuard.md).
