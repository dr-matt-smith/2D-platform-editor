// Level library: enumerate bundled levels (manifest), fetch their text, and
// manage per-level drafts / dirty state in storage. All side effects (fetch,
// storage) are injected so this is unit-tested headless (design v3 §7).

const MANIFEST_URL = '/data/levels/manifest.json';
const levelUrl = (file) => `/data/levels/${file}`;

const KEY = {
  draft: (id) => `ld:v3:draft:${id}`,
  lastOpen: 'ld:v3:lastOpen',
  migrated: 'ld:v3:migrated',
};
const LEGACY_KEY = 'leveldesigner:v1';

export function createLevels({ fetch, storage }) {
  let manifest = [];
  let baseline = ''; // text last loaded — the dirty comparison point

  // One-shot import of the v1 single-buffer key as a draft of the first
  // level. The `migrated` flag makes this idempotent (design v3 §5).
  function migrate() {
    if (storage.getItem(KEY.migrated)) return;
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy != null && manifest.length) {
      const id = manifest[0].id;
      storage.setItem(KEY.draft(id), legacy);
      storage.setItem(KEY.lastOpen, id);
      storage.removeItem(LEGACY_KEY);
    }
    storage.setItem(KEY.migrated, '1');
  }

  async function init() {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) throw new Error('failed to load level manifest');
    manifest = await res.json();
    migrate();
    return api;
  }

  const entry = (id) => manifest.find((m) => m.id === id);

  function list() {
    return manifest.map((m) => ({
      ...m,
      modified: storage.getItem(KEY.draft(m.id)) != null,
    }));
  }

  async function fetchOriginal(id) {
    const m = entry(id);
    if (!m) throw new Error(`unknown level: ${id}`);
    const res = await fetch(levelUrl(m.file));
    if (!res.ok) throw new Error(`failed to load ${m.file}`);
    return res.text();
  }

  // Draft takes precedence over the bundled original.
  async function load(id) {
    const draft = storage.getItem(KEY.draft(id));
    const text = draft != null ? draft : await fetchOriginal(id);
    baseline = text;
    return text;
  }

  function save(id, text) {
    storage.setItem(KEY.draft(id), text);
    baseline = text;
  }

  async function revert(id) {
    storage.removeItem(KEY.draft(id));
    const text = await fetchOriginal(id);
    baseline = text;
    return text;
  }

  const isDirty = (text) => text !== baseline;
  const lastOpen = () => storage.getItem(KEY.lastOpen);
  const setLastOpen = (id) => storage.setItem(KEY.lastOpen, id);

  const api = {
    init,
    list,
    load,
    save,
    revert,
    isDirty,
    lastOpen,
    setLastOpen,
  };
  return api;
}
