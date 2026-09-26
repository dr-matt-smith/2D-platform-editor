import { assert, assertEquals, assertNotEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { ScriptedInput, jsAdapter } from '@2d-platform/engine';
import { SimOutcome } from './SimOutcome.ts';
import { Simulator } from './Simulator.ts';

// The agent takes legends as plain records.
const DEFAULT_LEGEND = Legend.DEFAULT.toRecord();

const simulator = new Simulator(jsAdapter);

// --- ScriptedInput unit cases (the simulator's input source) -------

Deno.test('ScriptedInput: keys go down + up on schedule, pressed is one-shot', () => {
  const input = new ScriptedInput([
    { frame: 0, key: 'right', down: true },
    { frame: 5, key: 'right', down: false },
  ]);

  input.advance(0);
  assertEquals(input.isDown('right'), true);
  assertEquals(input.wasPressed('right'), true);

  input.advance(1);
  assertEquals(input.isDown('right'), true);
  // wasPressed cleared on frame turn-over.
  assertEquals(input.wasPressed('right'), false);

  input.advance(5);
  assertEquals(input.isDown('right'), false);
});

Deno.test('ScriptedInput: empty recording → nothing is ever pressed', () => {
  const input = new ScriptedInput([]);
  input.advance(0);
  assertEquals(input.isDown('right'), false);
  assertEquals(input.wasPressed('right'), false);
  input.advance(100);
  assertEquals(input.isDown('space'), false);
});

Deno.test('ScriptedInput: multi-key — left + jump simultaneously', () => {
  const input = new ScriptedInput([
    { frame: 0, key: 'left', down: true },
    { frame: 0, key: 'space', down: true },
  ]);
  input.advance(0);
  assertEquals(input.isDown('left'), true);
  assertEquals(input.isDown('space'), true);
  assertEquals(input.wasPressed('space'), true);
});

Deno.test('ScriptedInput: events out of order in the recording get sorted', () => {
  const input = new ScriptedInput([
    { frame: 5, key: 'right', down: false },
    { frame: 0, key: 'right', down: true },
  ]);
  input.advance(0);
  assertEquals(input.isDown('right'), true);
  input.advance(5);
  assertEquals(input.isDown('right'), false);
});

// --- Simulator.run: the headless replay ----------------------------

const PE_LEVEL = '#####\n#P.E#\n#####';

Deno.test('run: walking right reaches the exit (smoke)', () => {
  // Hold right long enough to cross from col 1 (P) to col 3 (E):
  // 40 px at 4 px/frame ≈ 10 frames.
  const recording = [
    { frame: 0, key: 'right', down: true },
    { frame: 120, key: 'right', down: false },
  ];
  const result = simulator.run(Level.parse(PE_LEVEL), DEFAULT_LEGEND, recording);
  assertEquals(result.outcome, SimOutcome.Won);
  assert(result.frame < 60, `expected fast win, got frame ${result.frame}`);
});

Deno.test('run: no input → times out without dying', () => {
  // The engine has no idle death.
  const result = simulator.run(Level.parse(PE_LEVEL), DEFAULT_LEGEND, [], { maxFrames: 30 });
  assertEquals(result.outcome, SimOutcome.Timeout);
  assertEquals(result.frame, 30);
});

Deno.test('run: falling into a pit kills the player', () => {
  // No floor under the player: it falls out of the world.
  const PIT = '#######\n#P...E#\n#.....#';
  const result = simulator.run(Level.parse(PIT), DEFAULT_LEGEND, [], { maxFrames: 200 });
  assertEquals(result.outcome, SimOutcome.Dead);
});

Deno.test('run: touching a spike kills the player', () => {
  const recording = [
    { frame: 0, key: 'right', down: true },
    { frame: 60, key: 'right', down: false },
  ];
  const result = simulator.run(Level.parse('######\n#P.^E#\n######'), DEFAULT_LEGEND, recording);
  assertEquals(result.outcome, SimOutcome.Dead);
});

Deno.test('run: collecting a coin increments score, all-coins required to win', () => {
  const recording = [
    { frame: 0, key: 'right', down: true },
    { frame: 120, key: 'right', down: false },
  ];
  const result = simulator.run(Level.parse('######\n#P.oE#\n######'), DEFAULT_LEGEND, recording);
  assertEquals(result.outcome, SimOutcome.Won);
  assertEquals(result.score, 1);
});

Deno.test('run: # pickup-required: 0 lets the player skip the coin', () => {
  const recording = [
    { frame: 0, key: 'right', down: true },
    { frame: 120, key: 'right', down: false },
  ];
  const result = simulator.run(Level.parse('# pickup-required: 0\n######\n#P.oE#\n######'), DEFAULT_LEGEND, recording);
  assertEquals(result.outcome, SimOutcome.Won);
});

Deno.test('run: pressing space changes the trajectory vs walk-only', () => {
  // Proves the jump key reaches the engine's physics: over the same
  // 5 frames, a player who taps space ends higher than one who doesn't.
  const FLAT =
    '.........\n' + // row 0 sky
    '.........\n' + // row 1 sky (jump headroom)
    '#P......E\n' + // row 2 player on floor (P col 1, E col 8)
    '#########'; //   row 3 floor
  const parsed = Level.parse(FLAT);
  const walkOnly = simulator.run(parsed, DEFAULT_LEGEND, [{ frame: 0, key: 'right', down: true }], { maxFrames: 5 });
  const walkAndJump = simulator.run(parsed, DEFAULT_LEGEND, [
    { frame: 0, key: 'right', down: true },
    // Frame 1, not 0: the player lands on the first update, and a jump
    // pressed before it is grounded is ignored.
    { frame: 1, key: 'space', down: true },
    { frame: 2, key: 'space', down: false },
  ], { maxFrames: 5 });
  assertEquals(walkOnly.outcome, SimOutcome.Timeout);
  assertEquals(walkAndJump.outcome, SimOutcome.Timeout);
  assertNotEquals(walkAndJump.pos.y, walkOnly.pos.y);
  assert(walkAndJump.pos.y < walkOnly.pos.y, 'jumping player should be higher (smaller y)');
});

Deno.test('run: maxFrames is honoured; the default budget is 600 frames', () => {
  const parsed = Level.parse(PE_LEVEL);
  const result = simulator.run(parsed, DEFAULT_LEGEND, [], { maxFrames: 5 });
  assertEquals(result.outcome, SimOutcome.Timeout);
  assertEquals(result.frame, 5);
  assertEquals(simulator.run(parsed, DEFAULT_LEGEND).frame, Simulator.DEFAULT_MAX_FRAMES);
});
