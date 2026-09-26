import type { LegendRecord } from './LegendRecord.ts';
import type { ParsedLevel } from './ParsedLevel.ts';
import type { Recording } from './RecordingEvent.ts';
import type { ScriptedInputHandle } from './InputSource.ts';
import type { SceneHandle } from './SceneHandle.ts';

/**
 * The agent's only link to a game engine. Every class that simulates
 * physics is handed one of these; the engine package implements it
 * (`JsPhysicsAdapter`), and so does the Python port.
 */
export interface PhysicsAdapter {
  /** Engine tile size in px; must equal the agent's TILE (see AdapterGuard). */
  readonly TILE: number;
  /** A fresh, already-entered scene. `tileset` is opaque to the agent. */
  makeScene(parsed: ParsedLevel, legend: LegendRecord | null, tileset: unknown): SceneHandle;
  /** A scripted input source that replays `recording`. */
  makeScriptedInput(recording: Recording): ScriptedInputHandle;
}
