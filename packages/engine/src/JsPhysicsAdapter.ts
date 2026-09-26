import { Legend } from '@2d-platform/level-format';
import { TILE } from './constants.ts';
import { PlaytestScene } from './PlaytestScene.ts';
import { ScriptedInput } from './ScriptedInput.ts';
import type { PhysicsAdapter } from '@2d-platform/agent';
import type { LegendRecord, LevelData } from '@2d-platform/level-format';
import type { RenderTileset } from '@2d-platform/render';
import type { RecordingEvent } from './RecordingEvent.ts';
import type { SceneHost } from './SceneHost.ts';

// This engine, offered to the planning agent through the agent's
// `PhysicsAdapter` interface. The agent never imports the engine: it is
// handed an adapter and calls `makeScene` / `makeScriptedInput`, so the
// same planner can drive another engine (the Python port has its own
// adapter). The engine depends on the agent only for that interface's
// type.
//
// The scenes it makes run headless: no canvas and no animation loop, just
// `update(dt)` called by the agent's simulator.
export class JsPhysicsAdapter implements PhysicsAdapter {
  // The engine's tile size; the agent checks it matches its own.
  readonly TILE: number = TILE;

  // A fresh playtest scene, already entered (entities built, phase
  // 'play'), so the caller can set the player's state and step at once.
  // The agent hands legends over as plain records (it never imports
  // level-format), so the record is turned back into a `Legend` here.
  makeScene(level: LevelData, legend: LegendRecord | null, tileset: RenderTileset | null = null): PlaytestScene {
    // `input` is a placeholder the agent replaces per simulated action.
    // Sounds are silent: planning runs thousands of simulations.
    const host: SceneHost = { input: new ScriptedInput(), sounds: { play() {} } };
    const scene = new PlaytestScene(host, level, Legend.fromRecord(legend), tileset);
    scene.enter();
    return scene;
  }

  makeScriptedInput(recording: readonly RecordingEvent[] = []): ScriptedInput {
    return new ScriptedInput(recording);
  }
}

// The shared adapter instance that callers pass to the agent.
export const jsAdapter = new JsPhysicsAdapter();
