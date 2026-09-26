import type { InputSource } from './InputSource.ts';
import type { PlayerBody, PlayerState } from './PlayerState.ts';

/**
 * A scene's phase. A string union rather than an enum: the engine's own
 * `GamePhase` enum has the same three values, and TypeScript lets the
 * engine's enum satisfy a union of literals but not a different enum.
 */
export type ScenePhase = 'play' | 'won' | 'dead';

/** The scene's mutable game object; the agent swaps `input` per simulation. */
export interface SceneGame {
  input: InputSource;
}

/** The surface of the engine's playtest scene the agent uses. */
export interface SceneHandle {
  game: SceneGame;
  player: PlayerBody;
  coins: Array<{ collected: boolean }>;
  phase: ScenePhase;
  score: number;
  /** Scripted-input frame counter. */
  simFrame: number;
  /** Wall-clock accumulator. */
  simTime: number;
  /** Builds the entities; phase becomes 'play'. */
  enter(): void;
  /** Steps physics one tick. */
  update(dt: number): void;
  /** Forces the player's state. */
  setPlayerState(state: PlayerState): void;
}
