// @2d-platform/agent — public API.
//
// The 2D level-designer's planning agent, carved out of the editor in
// v29 so alternate engine implementations (Python, MCP-callable) can
// plug in via a thin physics-adapter API. The agent is engine-agnostic:
// every entry that simulates physics (testLevel, plan, simulate,
// buildNavGraph, planPerFrame, expandNode) takes the adapter via
// opts.adapter (or a leading arg for buildNavGraph). See README.md for
// the adapter contract.

export { testLevel } from './runner.ts';
export { plan, replan, aStar, assertAdapter } from './planner.ts';
export {
  planPerFrame,
  aStarPerFrame,
  expandNode,
  makeContextCache,
  clusterKey,
  nearby,
} from './perframe.ts';
export { simulate } from './sim.ts';
export {
  buildNavGraph,
  stateKey,
  vxBucketOf,
  xOffsetBucketOf,
  bucketCentreX,
  parseStateKey,
  VX_BUCKETS,
  X_OFFSET_BUCKETS,
  JUMP_MAX_HORIZ_CELLS,
  JUMP_MAX_VERT_CELLS,
} from './grid.ts';
export {
  enumerateActions,
  actionToRecording,
  WALK_FRAMES_PER_CELL,
  DROP_HOLD_FRAMES_BUDGET,
} from './actions.ts';
export { TILE } from './constants.ts';

export type {
  PhysicsAdapter,
  SceneHandle,
  SceneGame,
  ScenePhase,
  InputSource,
  ScriptedInputHandle,
  PlayerState,
  PlayerBody,
  ParsedLevel,
  PickupRequired,
  Legend,
  LegendEntry,
  SimulateArgs,
  SimResult,
} from './sim.ts';
export type {
  Dir,
  Action,
  ActionKind,
  MoveAction,
  WalkAction,
  JumpAction,
  DropAction,
  DropReleaseAction,
  RunOffAction,
  WaitAction,
  Recording,
  RecordingEvent,
} from './actions.ts';
export type {
  Point,
  Velocity,
  SimContext,
  SimActionOptions,
  SimActionOutcome,
  SimActionResult,
  SimulateActionArgs,
} from './simAction.ts';
export type {
  Cell,
  XOffsetBucket,
  NavNode,
  NavEdge,
  NavGraph,
  PlanGraph,
} from './grid.ts';
export type {
  Plan,
  PlanOptions,
  PlanStats,
  TraceEntry,
  UnreachableGoal,
  NavPathStep,
} from './planner.ts';
export type {
  ClusterTolerance,
  ContextCache,
  PerFrameEdge,
  PerFrameStep,
  ExpandNodeOptions,
  AStarPerFrameOptions,
  PerFramePlanOptions,
  LevelGoals,
} from './perframe.ts';
export type {
  TestLevelOptions,
  TestLevelResult,
  TestLevelSuccess,
  TestLevelFailure,
  Solution,
  SolutionStats,
} from './runner.ts';
