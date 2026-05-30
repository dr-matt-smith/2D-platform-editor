// @2d-platform/agent — public API.
//
// The 2D level-designer's planning agent, carved out of the editor in
// v29 so alternate engine implementations (Python, MCP-callable) can
// plug in via a thin physics-adapter API. The agent is engine-agnostic:
// every entry that simulates physics (testLevel, plan, simulate,
// buildNavGraph, planPerFrame, expandNode) takes the adapter via
// opts.adapter (or a leading arg for buildNavGraph). See README.md for
// the adapter contract.

export { testLevel } from './runner.js';
export { plan, replan, aStar, assertAdapter } from './planner.js';
export {
  planPerFrame,
  aStarPerFrame,
  expandNode,
  makeContextCache,
  clusterKey,
  nearby,
} from './perframe.js';
export { simulate } from './sim.js';
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
} from './grid.js';
export {
  enumerateActions,
  actionToRecording,
  WALK_FRAMES_PER_CELL,
  DROP_HOLD_FRAMES_BUDGET,
} from './actions.js';
export {
  renderSolutionOverlay,
  renderAllSolutionsOverlay,
  HUE_PALETTE,
} from './overlay.js';
export { TILE } from './constants.js';
