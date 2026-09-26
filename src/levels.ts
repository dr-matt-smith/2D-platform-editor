// Level library: enumerate bundled levels (manifest), fetch their text, and
// manage per-level drafts / dirty state in storage. All side effects (fetch,
// storage) are injected so this is unit-tested headless (design v3 §7).

// `BASE` is the deploy base URL (Vite injects `import.meta.env.BASE_URL`
// at build time — '/' in dev and on a root deploy, '/2D-platform-editor/'
// on GitHub Pages). Under `node --test` `import.meta.env` is undefined,
// so the `?? '/'` fallback keeps URLs byte-identical to the v1–v8 paths
// and the existing fetch-URL assertions in levels.test.ts still hold.
const BASE = import.meta.env?.BASE_URL ?? '/';
const MANIFEST_URL = `${BASE}data/levels/manifest.json`;
const TILESETS_URL = `${BASE}data/tilesets/manifest.json`;
const levelUrl = (file: string) => `${BASE}data/levels/${file}`;

const KEY = {
  draft: (id: string) => `ld:v3:draft:${id}`,
  lastOpen: 'ld:v3:lastOpen',
  migrated: 'ld:v3:migrated',
  // v24 M1: paste-to-load entries — local-only, no bundled file. The
  // list is a JSON array of {id, name} stored under one key; the text
  // for each lives under the existing draft key (so load(id) Just
  // Works for these too).
  locals: 'ld:v24:locals',
};
const LEGACY_KEY = 'leveldesigner:v1';

// The subset of `Storage` (localStorage) the level library uses.
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
// The subset of `Response` the level library uses.
export interface FetchResponseLike {
  ok: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
}
export type FetchLike = (url: string) => Promise<FetchResponseLike>;

export interface LevelsDeps {
  fetch: FetchLike;
  storage: StorageLike;
}

// One bundled level from public/data/levels/manifest.json.
export interface LevelManifestEntry {
  id: string;
  name: string;
  file: string;
  group?: string;
}
// One paste-loaded local level (v24), stored under `KEY.locals`.
export interface LocalLevelEntry {
  id: string;
  name: string;
}
// One row of `list()`: a bundled level (with its file) or a local one.
export interface LevelListItem {
  id: string;
  name: string;
  file: string | null;
  group?: string;
  modified: boolean;
}
// One tileset from public/data/tilesets/manifest.json.
export interface TilesetManifestEntry {
  id: string;
  name: string;
}

// The level library returned by `createLevels`.
export interface LevelsStore {
  init(): Promise<LevelsStore>;
  list(): LevelListItem[];
  tilesets(): Promise<TilesetManifestEntry[]>;
  load(id: string): Promise<string>;
  peek(id: string): Promise<string>;
  save(id: string, text: string): void;
  revert(id: string): Promise<string>;
  isDirty(text: string): boolean;
  lastOpen(): string | null;
  setLastOpen(id: string): void;
  addLocal(text: string, name?: string): string;
  removeLocal(id: string): void;
  isLocalId(id: unknown): boolean;
}

export function createLevels({ fetch, storage }: LevelsDeps): LevelsStore {
  let manifest: LevelManifestEntry[] = [];
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

  async function init(): Promise<LevelsStore> {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) throw new Error('failed to load level manifest');
    manifest = (await res.json()) as LevelManifestEntry[];
    migrate();
    return api;
  }

  const entry = (id: string) => manifest.find((m) => m.id === id);

  // v24 M1: paste-loaded local levels live alongside the manifest in
  // the dropdown. Read on demand (cheap; localStorage parse).
  function readLocals(): LocalLevelEntry[] {
    try {
      const raw = storage.getItem(KEY.locals);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  function writeLocals(arr: LocalLevelEntry[]) {
    storage.setItem(KEY.locals, JSON.stringify(arr));
  }
  const isLocalId = (id: unknown): boolean => typeof id === 'string' && id.startsWith('local-');

  function list(): LevelListItem[] {
    const fromManifest = manifest.map((m) => ({
      ...m,
      modified: storage.getItem(KEY.draft(m.id)) != null,
    }));
    const fromLocals = readLocals().map((l) => ({
      id: l.id,
      name: l.name,
      file: null,
      group: 'local',
      modified: false, // a "draft" for a local IS the level — no baseline drift
    }));
    return [...fromManifest, ...fromLocals];
  }

  /**
   * v24 M1: create a new local-only level from pasted text. Stores
   * the text under the standard draft key so load(id) finds it the
   * same way it finds drafts of bundled levels. Returns the new id.
   */
  function addLocal(text: string, name = 'untitled') {
    const id = `local-${randomId(8)}`;
    storage.setItem(KEY.draft(id), text);
    const locals = readLocals();
    locals.push({ id, name });
    writeLocals(locals);
    return id;
  }
  function removeLocal(id: string) {
    if (!isLocalId(id)) return;
    storage.removeItem(KEY.draft(id));
    writeLocals(readLocals().filter((l) => l.id !== id));
  }
  // 8-char hex; ~10^9 combinations — collision check on call site.
  function randomId(n: number) {
    let out = '';
    const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < n; i++) out += a[Math.floor(Math.random() * a.length)];
    return out;
  }

  async function fetchOriginal(id: string): Promise<string> {
    const m = entry(id);
    if (!m) throw new Error(`unknown level: ${id}`);
    const res = await fetch(levelUrl(m.file));
    if (!res.ok) throw new Error(`failed to load ${m.file}`);
    return res.text();
  }

  // Draft takes precedence over the bundled original. v24 M1: local
  // levels are draft-only (no original file) — load() returns the
  // draft directly without attempting to fetch.
  async function load(id: string) {
    const draft = storage.getItem(KEY.draft(id));
    if (isLocalId(id)) {
      // Local-only: there is no original to fall back to.
      const text = draft ?? '';
      baseline = text;
      return text;
    }
    const text = draft != null ? draft : await fetchOriginal(id);
    baseline = text;
    return text;
  }

  // Read a level's text WITHOUT touching the dirty baseline (used by the
  // dialog's per-row download). Local levels have no original to fetch.
  async function peek(id: string) {
    const draft = storage.getItem(KEY.draft(id));
    if (isLocalId(id)) return draft ?? '';
    return draft != null ? draft : fetchOriginal(id);
  }

  function save(id: string, text: string) {
    storage.setItem(KEY.draft(id), text);
    baseline = text;
  }

  async function revert(id: string) {
    // A local level's draft IS the level (there is no original to fall
    // back to), so reverting keeps its stored text instead of deleting it.
    if (isLocalId(id)) {
      const text = storage.getItem(KEY.draft(id)) ?? '';
      baseline = text;
      return text;
    }
    storage.removeItem(KEY.draft(id));
    const text = await fetchOriginal(id);
    baseline = text;
    return text;
  }

  // Available tilesets for the "New level" chooser (build-generated manifest;
  // public/ is not directory-listable). Memoised after the first hit; an
  // offline/missing manifest degrades to [] so the dialog offers the default.
  let tilesetList: TilesetManifestEntry[] | null = null;
  async function tilesets() {
    if (tilesetList) return tilesetList;
    try {
      const res = await fetch(TILESETS_URL);
      if (res.ok) tilesetList = (await res.json()) as TilesetManifestEntry[];
    } catch {
      /* offline → [] (caller falls back to the default tileset) */
    }
    return (tilesetList ??= []);
  }

  const isDirty = (text: string) => text !== baseline;
  const lastOpen = () => storage.getItem(KEY.lastOpen);
  const setLastOpen = (id: string) => storage.setItem(KEY.lastOpen, id);

  const api: LevelsStore = {
    init,
    list,
    tilesets,
    load,
    peek,
    save,
    revert,
    isDirty,
    lastOpen,
    setLastOpen,
    // v24 M1
    addLocal,
    removeLocal,
    isLocalId,
  };
  return api;
}
