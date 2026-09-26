import { assert, assertEquals } from '@std/assert';
import {
  parse,
  serialize,
  setViewportDirective,
  VIEWPORT_MIN,
  VIEWPORT_MAX,
} from './level.ts';
import type { Dimensions } from './level.ts';

const GRID = '#####\n#P.E#\n#####';

// --- parse: # viewport: ---------------------------------------------

Deno.test('parse: meta.viewport defaults to null (whole-world / fit mode)', () => {
  const p = parse(GRID);
  assertEquals(p.meta.viewport, null);
});

Deno.test('parse: # viewport: fit → null (explicit fit equals absent)', () => {
  const p = parse(`# viewport: fit\n${GRID}`);
  assertEquals(p.meta.viewport, null);
});

Deno.test('parse: # viewport: 20x10 → { w: 20, h: 10 }', () => {
  const p = parse(`# viewport: 20x10\n${GRID}`);
  assertEquals(p.meta.viewport, { w: 20, h: 10 });
});

Deno.test('parse: # viewport: 20X10 (uppercase X) also parses', () => {
  const p = parse(`# viewport: 20X10\n${GRID}`);
  assertEquals(p.meta.viewport, { w: 20, h: 10 });
});

Deno.test('parse: clamps below VIEWPORT_MIN (4) up', () => {
  const p = parse(`# viewport: 2x1\n${GRID}`);
  assertEquals(p.meta.viewport, { w: VIEWPORT_MIN, h: VIEWPORT_MIN });
});

Deno.test('parse: clamps above VIEWPORT_MAX (200) down', () => {
  const p = parse(`# viewport: 500x500\n${GRID}`);
  assertEquals(p.meta.viewport, { w: VIEWPORT_MAX, h: VIEWPORT_MAX });
});

Deno.test('parse: malformed `# viewport: hello` → stays null', () => {
  const p = parse(`# viewport: hello\n${GRID}`);
  assertEquals(p.meta.viewport, null);
});

// --- serialize: round-trip ------------------------------------------

Deno.test('serialize: omits # viewport: when meta.viewport is null', () => {
  const out = serialize({ meta: { viewport: null }, grid: GRID.split('\n') });
  assertEquals(out.includes('# viewport:'), false);
});

Deno.test('serialize: emits # viewport: WxH when meta.viewport is set', () => {
  const out = serialize({ meta: { viewport: { w: 20, h: 10 } }, grid: GRID.split('\n') });
  assertEquals(out.includes('# viewport: 20x10'), true);
});

Deno.test('serialize → parse round-trip preserves the viewport', () => {
  const src = `# viewport: 24x14\n${GRID}`;
  const round = serialize(parse(src));
  assertEquals(parse(round).meta.viewport, { w: 24, h: 14 });
});

Deno.test('serialize → parse round-trip absent stays absent', () => {
  const src = GRID;
  const round = serialize(parse(src));
  assertEquals(parse(round).meta.viewport, null);
});

// --- setViewportDirective: pure setter ------------------------------

Deno.test('setViewportDirective: adds a new # viewport: line into the header band', () => {
  const out = setViewportDirective(GRID, { w: 20, h: 10 });
  assertEquals(out.startsWith('# viewport: 20x10\n'), true);
  assertEquals(out.endsWith(GRID), true);
});

Deno.test('setViewportDirective: replaces an existing # viewport: line', () => {
  const out = setViewportDirective(`# viewport: 10x6\n${GRID}`, { w: 30, h: 18 });
  assertEquals(out.startsWith('# viewport: 30x18\n'), true);
  assertEquals(out.includes('# viewport: 10x6'), false);
});

Deno.test('setViewportDirective: null removes the line', () => {
  const out = setViewportDirective(`# viewport: 20x10\n${GRID}`, null);
  assertEquals(out.includes('# viewport:'), false);
  assertEquals(out, GRID);
});

Deno.test("setViewportDirective: 'fit' is equivalent to null (removes the line)", () => {
  const out = setViewportDirective(`# viewport: 20x10\n${GRID}`, 'fit');
  assertEquals(out.includes('# viewport:'), false);
});

Deno.test('setViewportDirective: clamps before writing', () => {
  const out = setViewportDirective(GRID, { w: 1000, h: 1 });
  // 1000 → 200 (VIEWPORT_MAX); 1 → 4 (VIEWPORT_MIN).
  assertEquals(out.startsWith('# viewport: 200x4\n'), true);
});

Deno.test('setViewportDirective: garbage value (no w/h) removes the line', () => {
  const out = setViewportDirective(`# viewport: 20x10\n${GRID}`, 'nonsense' as unknown as Dimensions);
  assertEquals(out.includes('# viewport:'), false);
});

// --- coexistence with the v18 directives ----------------------------

Deno.test('parse: # viewport: plays nicely with # background-image: + # pickup-required:', () => {
  const src =
    `# background-image: bg-blue-clouds\n` +
    `# pickup-required: 3\n` +
    `# viewport: 24x14\n` +
    GRID;
  const p = parse(src);
  assertEquals(p.meta.backgroundImage, 'bg-blue-clouds');
  assertEquals(p.meta.pickupRequired, 3);
  assertEquals(p.meta.viewport, { w: 24, h: 14 });
});

Deno.test('serialize: emits viewport after background-image + pickup-required', () => {
  const out = serialize({
    meta: {
      tileset: 'PlayWithYourPeas',
      backgroundImage: 'bg-blue-clouds',
      pickupRequired: 3,
      viewport: { w: 24, h: 14 },
    },
    grid: GRID.split('\n'),
  });
  // The directive order is the same as the meta-field assignment order
  // in serialize(); verify by index so future reorderings break the
  // test loudly.
  const lines = out.split('\n');
  const bgIdx = lines.findIndex((l) => l.startsWith('# background-image:'));
  const prIdx = lines.findIndex((l) => l.startsWith('# pickup-required:'));
  const vpIdx = lines.findIndex((l) => l.startsWith('# viewport:'));
  assert(bgIdx >= 0 && prIdx >= 0 && vpIdx >= 0);
  assert(bgIdx < prIdx && prIdx < vpIdx, 'viewport should emit after the v18 directives');
});
