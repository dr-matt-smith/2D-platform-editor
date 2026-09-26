// @2d-platform/agent — the planning agent: finds key recordings that
// solve a level, by A* over simulated physics.
//
// The agent never imports an engine. Everything that simulates takes a
// `PhysicsAdapter` (the engine package's `jsAdapter` is one), so the same
// planner can drive another engine. Start with `LevelTester` (plan, check
// and collect solutions) or `PlannerFactory` (one plan).
export * from './constants.ts';

// Testing a level
export { LevelTester } from './LevelTester.ts';
export { Solution } from './Solution.ts';
export { SearchBudget } from './SearchBudget.ts';
export { FailureReason } from './FailureReason.ts';

// Planning strategies
export { Planner } from './Planner.ts';
export { PlannerKind } from './PlannerKind.ts';
export { PlannerFactory } from './PlannerFactory.ts';
export { PerFramePlanner } from './PerFramePlanner.ts';
export { BucketPlanner } from './BucketPlanner.ts';
export { Plan } from './Plan.ts';
export { PlanBuilder } from './PlanBuilder.ts';
export { GoalKind } from './GoalKind.ts';

// The per-frame search
export { PerFrameExpander } from './PerFrameExpander.ts';
export { StateCluster } from './StateCluster.ts';

// The bucket search
export { NavGraph } from './NavGraph.ts';
export { PickupTour } from './PickupTour.ts';
export { StateKey } from './StateKey.ts';
export { XOffsetBucket } from './XOffsetBucket.ts';

// The level
export { LevelGrid } from './LevelGrid.ts';
export { GlyphRole } from './GlyphRole.ts';
export { CellKey } from './CellKey.ts';

// Actions
export { Action } from './Action.ts';
export { MoveAction } from './MoveAction.ts';
export { WalkAction } from './WalkAction.ts';
export { JumpAction } from './JumpAction.ts';
export { DropAction } from './DropAction.ts';
export { DropReleaseAction } from './DropReleaseAction.ts';
export { RunOffAction } from './RunOffAction.ts';
export { WaitAction } from './WaitAction.ts';
export { ActionCatalog } from './ActionCatalog.ts';
export { ActionKind } from './ActionKind.ts';
export { Direction } from './Direction.ts';

// Simulation
export { Simulator } from './Simulator.ts';
export { SimOutcome } from './SimOutcome.ts';
export { ActionSimulator } from './ActionSimulator.ts';
export { ActionOutcome } from './ActionOutcome.ts';
export { AdapterGuard } from './AdapterGuard.ts';

// Contracts and data shapes
export type { PhysicsAdapter } from './PhysicsAdapter.ts';
export type { SceneHandle, SceneGame, ScenePhase } from './SceneHandle.ts';
export type { InputSource, ScriptedInputHandle } from './InputSource.ts';
export type { PlayerState, PlayerBody, Point, Velocity } from './PlayerState.ts';
export type { ParsedLevel, PickupRequired } from './ParsedLevel.ts';
export type { LegendRecord, LegendRecordEntry } from './LegendRecord.ts';
export type { Recording, RecordingEvent } from './RecordingEvent.ts';
export type { Cell } from './Cell.ts';
export type { LevelLayout } from './LevelLayout.ts';
export type { TraceEntry } from './TraceEntry.ts';
export type { PlanData, PlanStats, UnreachableGoal } from './Plan.ts';
export type { PlanOptions } from './Planner.ts';
export type { PerFramePlannerOptions } from './PerFramePlanner.ts';
export type { PerFrameEdge, PerFrameStep, PerFrameTargets } from './PerFrameExpander.ts';
export type { ClusterTolerance } from './StateCluster.ts';
export type { NavNode, NavEdge, NavPathStep } from './NavGraph.ts';
export type { ActionResult, SimulateActionOptions } from './ActionResult.ts';
export type { SimResult, SimulatorRunOptions } from './Simulator.ts';
export type { SolutionStats } from './Solution.ts';
export type { ProgressListener } from './SearchBudget.ts';
export type { LevelTestOptions } from './LevelTester.ts';
export type { LevelTestResult, LevelTestSuccess, LevelTestFailure } from './LevelTestResult.ts';
