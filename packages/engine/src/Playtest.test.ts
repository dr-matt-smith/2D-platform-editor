import { assert, assertEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { GamePhase } from './GamePhase.ts';
import { Playtest } from './Playtest.ts';

// Deno has no canvas or animation loop: stand in a canvas whose 2D
// context only needs to accept `imageSmoothingEnabled`, and a
// requestAnimationFrame that never calls back (so the loop never runs).
function fakeCanvas(): HTMLCanvasElement {
  return { width: 0, height: 0, getContext: () => ({ imageSmoothingEnabled: true }) } as unknown as HTMLCanvasElement;
}
function withFakeAnimationFrame(run: () => void): void {
  const g = globalThis as { requestAnimationFrame?: unknown };
  const saved = g.requestAnimationFrame;
  g.requestAnimationFrame = () => 0;
  try {
    run();
  } finally {
    g.requestAnimationFrame = saved;
  }
}

const PLAYABLE = Level.parse('#####\n#P.E#\n#####');
// Demo mode (a recording) avoids needing a window for keyboard input.
const DEMO = { recording: [] };

Deno.test('launch refuses a level the gate blocks, with its reasons', () => {
  const r = Playtest.launch(Level.parse('#####\n#P..#\n#####'), Legend.DEFAULT, null, fakeCanvas());
  assertEquals(r.ok, false);
  assertEquals(r.playtest, null);
  assert(r.reasons.some((i) => /needs an exit/.test(i.message)));
  assertEquals(Playtest.isOpen, false);
});

Deno.test('launch sizes the canvas to the world, or to the viewport', () => {
  withFakeAnimationFrame(() => {
    const canvas = fakeCanvas();
    Playtest.launch(PLAYABLE, Legend.DEFAULT, null, canvas, DEMO).playtest!.exit();
    assertEquals([canvas.width, canvas.height], [5 * 20, 3 * 20]);

    const wide = Level.parse('# viewport: 6x4\n############\n#P........E#\n#..........#\n#..........#\n############');
    const vp = wide.meta.viewport!;
    Playtest.launch(wide, Legend.DEFAULT, null, canvas, DEMO).playtest!.exit();
    assertEquals([canvas.width, canvas.height], [vp.w * 20, vp.h * 20]);
    assert(canvas.width < wide.meta.width * 20, 'narrower than the world');
  });
});

Deno.test('only one playtest runs at a time', () => {
  withFakeAnimationFrame(() => {
    const first = Playtest.launch(PLAYABLE, Legend.DEFAULT, null, fakeCanvas(), DEMO);
    assert(first.ok && first.playtest);
    assertEquals(Playtest.isOpen, true);

    const second = Playtest.launch(PLAYABLE, Legend.DEFAULT, null, fakeCanvas(), DEMO);
    assertEquals([second.ok, second.playtest, second.reasons], [true, null, []]);

    first.playtest.exit();
    assertEquals(Playtest.isOpen, false);
    const third = Playtest.launch(PLAYABLE, Legend.DEFAULT, null, fakeCanvas(), DEMO);
    assert(third.playtest);
    third.playtest.exit();
  });
});

Deno.test('phase, restart, and exit firing onExit exactly once', () => {
  withFakeAnimationFrame(() => {
    const playtest = Playtest.launch(PLAYABLE, Legend.DEFAULT, null, fakeCanvas(), DEMO).playtest!;
    assertEquals(playtest.phase, GamePhase.Play);
    playtest.restart();
    assertEquals(playtest.phase, GamePhase.Play);

    let exits = 0;
    playtest.onExit(() => exits++);
    playtest.exit();
    playtest.exit();
    assertEquals(exits, 1);
    assertEquals(playtest.isClosed, true);
  });
});
