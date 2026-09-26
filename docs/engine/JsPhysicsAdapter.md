# JsPhysicsAdapter

`packages/engine/src/JsPhysicsAdapter.ts` · class

This engine, offered to the planning agent through the agent package's
`PhysicsAdapter` interface. The shared instance is exported as `jsAdapter`.

## Relationships
- implements the agent package's `PhysicsAdapter` (a type-only import: the engine never runs agent code)
- makes headless [PlaytestScene](PlaytestScene.md)s (with a plain [SceneHost](SceneHost.md)) and [ScriptedInput](ScriptedInput.md)s
- used by the agent's planner and simulator, the editor's Test button, `apps/agent-cli`, and `packages/agent-py/tools/gen_golden.ts`

## Members
| Member | Kind | Description |
|---|---|---|
| `TILE` | readonly property | The engine's tile size (20); the agent checks it matches its own |
| `makeScene(level, legend, tileset?)` | method | A fresh, already-entered scene. `legend` is a plain record (the agent never imports level-format's `Legend`) |
| `makeScriptedInput(recording?)` | method | A [ScriptedInput](ScriptedInput.md) over the recording |

`jsAdapter` is `new JsPhysicsAdapter()`, the instance callers pass to the
agent.

## Example
```ts
import { LevelTester } from '@2d-platform/agent';
import { jsAdapter } from '@2d-platform/engine';

const result = await LevelTester.create(jsAdapter)
  .test(level, legend.toRecord(), null, { maxRuntimeMs: 5000 });
```

## Design notes
- **Adapter pattern.** The agent defines the interface it needs
  (`PhysicsAdapter`); this class adapts the engine to it. The planner can
  therefore drive other engines too — the Python port has its own adapter,
  checked against this one by the golden vectors.
- **Dependency inversion across packages.** The agent (higher-level policy)
  doesn't depend on the engine; the engine depends on the agent's
  *interface*, and only as a type.
- **Headless without casts.** Because [PlaytestScene](PlaytestScene.md)
  depends on [SceneHost](SceneHost.md), the adapter passes a plain
  `{ input, sounds }` object: silent, no canvas, no loop.
- **Extensible by inheritance.** A test that needs a misconfigured adapter
  subclasses it and overrides `TILE`.
