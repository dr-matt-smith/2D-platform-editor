// The state of a playtest. The values are the strings the agent package
// compares against (its `ScenePhase` type), so they must not change.
export enum GamePhase {
  // Running: the player can move.
  Play = 'play',
  // Terminal: enough pickups collected and an exit reached.
  Won = 'won',
  // Terminal: touched a hazard or fell out of the world.
  Dead = 'dead',
}
