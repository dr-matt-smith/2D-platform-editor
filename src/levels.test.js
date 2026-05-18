import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevels } from './levels.js';

// localStorage-shaped fake: getItem returns null when absent.
function fakeStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    has: (k) => m.has(k),
  };
}

const MANIFEST = [
  { id: 'above_ground', name: 'above_ground', file: 'above_ground.txt' },
  { id: 'below_ground', name: 'below_ground', file: 'below_ground.txt' },
];
const ORIGINALS = {
  '/data/levels/above_ground.txt': 'ABOVE',
  '/data/levels/below_ground.txt': 'BELOW',
};

function fakeFetch() {
  return async (url) => {
    if (url === '/data/levels/manifest.json')
      return { ok: true, json: async () => MANIFEST };
    if (url in ORIGINALS)
      return { ok: true, text: async () => ORIGINALS[url] };
    return { ok: false };
  };
}

async function setup(seed) {
  const storage = fakeStorage(seed);
  const levels = createLevels({ fetch: fakeFetch(), storage });
  await levels.init();
  return { levels, storage };
}

test('load returns the original and clears dirty', async () => {
  const { levels } = await setup();
  const text = await levels.load('above_ground');
  assert.equal(text, 'ABOVE');
  assert.equal(levels.isDirty('ABOVE'), false);
  assert.equal(levels.isDirty('ABOVE!'), true);
});

test('a saved draft takes precedence over the original', async () => {
  const { levels, storage } = await setup();
  await levels.load('above_ground');
  levels.save('above_ground', 'EDITED');
  assert.equal(storage.getItem('ld:v3:draft:above_ground'), 'EDITED');
  assert.equal(await levels.load('above_ground'), 'EDITED');
  assert.equal(levels.isDirty('EDITED'), false); // save reset the baseline
});

test('revert deletes the draft and reloads the original', async () => {
  const { levels, storage } = await setup();
  levels.save('below_ground', 'JUNK');
  assert.equal(await levels.revert('below_ground'), 'BELOW');
  assert.equal(storage.has('ld:v3:draft:below_ground'), false);
});

test('list flags levels that have a draft', async () => {
  const { levels } = await setup();
  levels.save('below_ground', 'X');
  const byId = Object.fromEntries(levels.list().map((l) => [l.id, l.modified]));
  assert.deepEqual(byId, { above_ground: false, below_ground: true });
});

test('legacy v1 key migrates once into the first level draft', async () => {
  const { levels, storage } = await setup({ 'leveldesigner:v1': 'OLD' });
  assert.equal(storage.getItem('ld:v3:draft:above_ground'), 'OLD');
  assert.equal(storage.getItem('ld:v3:lastOpen'), 'above_ground');
  assert.equal(storage.has('leveldesigner:v1'), false);

  // Re-adding the legacy key and re-init must NOT migrate again.
  storage.setItem('leveldesigner:v1', 'AGAIN');
  const again = createLevels({ fetch: fakeFetch(), storage });
  await again.init();
  assert.equal(storage.getItem('ld:v3:draft:above_ground'), 'OLD');
  assert.equal(storage.has('leveldesigner:v1'), true); // left untouched
});

test('lastOpen round-trips', async () => {
  const { levels } = await setup();
  assert.equal(levels.lastOpen(), null);
  levels.setLastOpen('below_ground');
  assert.equal(levels.lastOpen(), 'below_ground');
});
