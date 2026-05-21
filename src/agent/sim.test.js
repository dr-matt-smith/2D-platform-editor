import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, DEFAULT_LEGEND } from '../level.js';
import { ScriptedInput } from '../play/scriptedInput.js';
import { simulate } from './sim.js';

// --- ScriptedInput unit cases (the simulator's input source) -------

test('ScriptedInput: keys go down + up on schedule, pressed is one-shot', () => {
  const recording = [
    { frame: 0, key: 'right', down: true },
    { frame: 5, key: 'right', down: false },
  ];
  const input = new ScriptedInput(recording);

  input.advance(0);
  assert.equal(input.isDown('right'), true);
  assert.equal(input.wasPressed('right'), true);

  input.advance(1);
  assert.equal(input.isDown('right'), true);
  // wasPressed cleared on frame turn-over.
  assert.equal(input.wasPressed('right'), false);

  input.advance(5);
  assert.equal(input.isDown('right'), false);
});

test('ScriptedInput: empty recording → nothing is ever pressed', () => {
  const input = new ScriptedInput([]);
  input.advance(0);
  assert.equal(input.isDown('right'), false);
  assert.equal(input.wasPressed('right'), false);
  input.advance(100);
  assert.equal(input.isDown('space'), false);
});

test('ScriptedInput: multi-key — left + jump simultaneously', () => {
  const input = new ScriptedInput([
    { frame: 0, key: 'left', down: true },
    { frame: 0, key: 'space', down: true },
  ]);
  input.advance(0);
  assert.equal(input.isDown('left'), true);
  assert.equal(input.isDown('space'), true);
  assert.equal(input.wasPressed('space'), true);
});

test('ScriptedInput: events out of order in the recording get sorted', () => {
  const input = new ScriptedInput([
    { frame: 5, key: 'right', down: false },
    { frame: 0, key: 'right', down: true },
  ]);
  input.advance(0);
  assert.equal(input.isDown('right'), true);
  input.advance(5);
  assert.equal(input.isDown('right'), false);
});

// --- simulate(): the headless PlaytestScene runner ------------------

const PE_LEVEL = '#####\n#P.E#\n#####';

test('simulate: walking right reaches the exit (smoke)', () => {
  const parsed = parse(PE_LEVEL);
  // Press right at frame 0 and hold until enough frames for the player to
  // cross from col 1 (P) to col 3 (E). SPEED = 240 px/s, TILE = 20 px →
  // 2 tiles = 40 px ≈ 10 frames at 1/60. Hold for plenty more to land.
  const recording = [
    { frame: 0, key: 'right', down: true },
    { frame: 120, key: 'right', down: false },
  ];
  const result = simulate({ parsed, legend: DEFAULT_LEGEND, recording });
  assert.equal(result.outcome, 'won');
  assert.ok(result.frame < 60, `expected fast win, got frame ${result.frame}`);
});

test('simulate: no input → times out without dying', () => {
  // Player sits on the floor doing nothing. Engine has no idle-death.
  const parsed = parse(PE_LEVEL);
  const result = simulate({
    parsed,
    legend: DEFAULT_LEGEND,
    recording: [],
    maxFrames: 30,
  });
  assert.equal(result.outcome, 'timeout');
  assert.equal(result.frame, 30);
});

test('simulate: falling into a pit kills the player', () => {
  // Player spawns over a 2-tile-wide gap with no floor. Falls until y >
  // worldH + 50 → phase = dead.
  const PIT = '#######\n#P...E#\n#.....#';
  const parsed = parse(PIT);
  const result = simulate({
    parsed,
    legend: DEFAULT_LEGEND,
    recording: [], // no input — just fall
    maxFrames: 200,
  });
  assert.equal(result.outcome, 'dead');
});

test('simulate: touching a spike kills the player', () => {
  // Player walks right into a spike before reaching the exit.
  const SPIKE = '######\n#P.^E#\n######';
  const parsed = parse(SPIKE);
  const recording = [
    { frame: 0, key: 'right', down: true },
    { frame: 60, key: 'right', down: false },
  ];
  const result = simulate({ parsed, legend: DEFAULT_LEGEND, recording });
  assert.equal(result.outcome, 'dead');
});

test('simulate: collecting a coin increments score, all-coins required to win', () => {
  // Default pickup-required is "all". Walk right past the coin to the
  // exit: score should be 1, outcome won.
  const COIN = '######\n#P.oE#\n######';
  const parsed = parse(COIN);
  const recording = [
    { frame: 0, key: 'right', down: true },
    { frame: 120, key: 'right', down: false },
  ];
  const result = simulate({ parsed, legend: DEFAULT_LEGEND, recording });
  assert.equal(result.outcome, 'won');
  assert.equal(result.score, 1);
});

test('simulate: # pickup-required: 0 lets the player skip the coin', () => {
  // Walk past the coin and through… actually with parse-required: 0 the
  // exit wins on touch regardless of coin collection.
  const COIN = '# pickup-required: 0\n######\n#P.oE#\n######';
  const parsed = parse(COIN);
  const recording = [
    { frame: 0, key: 'right', down: true },
    { frame: 120, key: 'right', down: false },
  ];
  const result = simulate({ parsed, legend: DEFAULT_LEGEND, recording });
  assert.equal(result.outcome, 'won');
});

test('simulate: pressing space changes the trajectory vs walk-only', () => {
  // Lightweight proof that the jump key is wired through ScriptedInput
  // → Player.update → engine physics. Compare two simulations of the
  // same 5-frame window: one with space tapped at frame 1 (after
  // onGround settles on frame 0's landing), one without. The y-coords
  // must differ (one jumped, the other didn't). Engineered level
  // geometry for a precise jump arc is deferred to the M3 planner
  // tests; here we just prove the input pathway. Level has rows of
  // sky above to avoid head-bump capping the comparison.
  const FLAT =
    '.........\n' + // row 0 sky
    '.........\n' + // row 1 sky (jump headroom)
    '#P......E\n' + // row 2 player on floor (P col 1, E col 8)
    '#########'; //   row 3 floor
  const parsed = parse(FLAT);
  const walkOnly = simulate({
    parsed,
    legend: DEFAULT_LEGEND,
    recording: [{ frame: 0, key: 'right', down: true }],
    maxFrames: 5,
  });
  const walkAndJump = simulate({
    parsed,
    legend: DEFAULT_LEGEND,
    recording: [
      { frame: 0, key: 'right', down: true },
      // Frame 1, not 0 — the player's `onGround` starts false; the
      // first update tick is when they land on the platform. A jump
      // pressed before they've grounded is silently ignored (engine
      // logs "input:jump:ignored").
      { frame: 1, key: 'space', down: true },
      { frame: 2, key: 'space', down: false },
    ],
    maxFrames: 5,
  });
  // Both should be 'timeout' (5 frames isn't enough to reach the exit).
  assert.equal(walkOnly.outcome, 'timeout');
  assert.equal(walkAndJump.outcome, 'timeout');
  // The jumping player should be at a different (smaller) y.
  assert.notEqual(walkAndJump.pos.y, walkOnly.pos.y);
  assert.ok(walkAndJump.pos.y < walkOnly.pos.y, 'jumping player should be higher (smaller y)');
});

test('simulate: maxFrames is honoured', () => {
  const parsed = parse(PE_LEVEL);
  const result = simulate({
    parsed,
    legend: DEFAULT_LEGEND,
    recording: [],
    maxFrames: 5,
  });
  assert.equal(result.outcome, 'timeout');
  assert.equal(result.frame, 5);
});
