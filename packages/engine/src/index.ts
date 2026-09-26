// @2d-platform/engine — the playable game: the game loop, keyboard and
// scripted input, the entities and their physics, the playtest scene and
// camera, and `Playtest.launch` to play a level on a canvas.
// `JsPhysicsAdapter` (shared instance: `jsAdapter`) offers this engine to
// the planning agent through the agent's `PhysicsAdapter` interface.
export * from './constants.ts';
export { Aabb } from './Aabb.ts';
export { Axis } from './Axis.ts';
export { Coin } from './Coin.ts';
export { Entity } from './Entity.ts';
export { Game } from './Game.ts';
export { GamePhase } from './GamePhase.ts';
export { Goal } from './Goal.ts';
export { JsPhysicsAdapter, jsAdapter } from './JsPhysicsAdapter.ts';
export { Key } from './Key.ts';
export { KeyboardInput } from './KeyboardInput.ts';
export { Platform } from './Platform.ts';
export { PlatformKind } from './PlatformKind.ts';
export { Player } from './Player.ts';
export { Playtest } from './Playtest.ts';
export { PlaytestCamera } from './PlaytestCamera.ts';
export { PlaytestGate } from './PlaytestGate.ts';
export { PlaytestScene } from './PlaytestScene.ts';
export { Scene } from './Scene.ts';
export { ScriptedInput } from './ScriptedInput.ts';
export { Sound } from './Sound.ts';
export { SoundBank } from './SoundBank.ts';
export { Spike } from './Spike.ts';
export { World } from './World.ts';
export type { Box } from './Box.ts';
export type { CameraOrigin, DeadZone } from './PlaytestCamera.ts';
export type { GameOptions } from './Game.ts';
export type { GateResult } from './GateResult.ts';
export type { InputSource } from './InputSource.ts';
export type { KeyName } from './Key.ts';
export type { LaunchOptions } from './LaunchOptions.ts';
export type { PlayerStateOverride } from './Player.ts';
export type { PlaytestLaunch } from './PlaytestLaunch.ts';
export type { PlayOptions, SoundPlayer } from './SoundPlayer.ts';
export type { Point } from './Point.ts';
export type { RecordingEvent } from './RecordingEvent.ts';
export type { SceneHost } from './SceneHost.ts';
export type { Size } from './Size.ts';
export type { SynthNote } from './SoundBank.ts';
export type { UpdateContext } from './UpdateContext.ts';
