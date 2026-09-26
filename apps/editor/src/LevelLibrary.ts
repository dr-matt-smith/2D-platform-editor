import { ContentPaths } from './ContentPaths.ts';
import type { KeyValueStore } from './KeyValueStore.ts';
import type {
  LevelListItem,
  LevelManifestEntry,
  LocalLevelEntry,
  TilesetManifestEntry,
} from './LibraryEntries.ts';
import type { LevelFetch, LevelLibraryIO } from './LevelLibraryIO.ts';

// The editor's level library: the bundled levels (from the manifest),
// per-level drafts saved in storage, and levels pasted in by the user
// ("local" levels, which exist only in storage).
//
// It also remembers the text last loaded (the *baseline*), which is what
// "unsaved changes" means: the buffer differs from the baseline.
//
// All I/O comes through `LevelLibraryIO`, so it is unit-tested with fakes.
export class LevelLibrary {
  // Storage keys; unchanged from earlier versions so saved drafts load.
  private static readonly KEY = {
    draft: (id: string) => `ld:v3:draft:${id}`,
    lastOpen: 'ld:v3:lastOpen',
    migrated: 'ld:v3:migrated',
    // A JSON array of LocalLevelEntry; each local level's text is kept
    // under its draft key, so `load(id)` finds it like any draft.
    locals: 'ld:v24:locals',
  };
  // The single-buffer key of the very first version (see `migrate`).
  private static readonly LEGACY_KEY = 'leveldesigner:v1';
  private static readonly LOCAL_PREFIX = 'local-';
  private static readonly ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

  private readonly fetch: LevelFetch;
  private readonly storage: KeyValueStore;
  private manifest: LevelManifestEntry[] = [];
  private baseline = '';
  private tilesetList: TilesetManifestEntry[] | null = null;

  constructor({ fetch, storage }: LevelLibraryIO) {
    this.fetch = fetch;
    this.storage = storage;
  }

  // Whether `id` names a paste-loaded local level.
  static isLocalId(id: unknown): boolean {
    return typeof id === 'string' && id.startsWith(LevelLibrary.LOCAL_PREFIX);
  }

  // Fetch the level manifest. Rejects if it cannot be loaded (the editor
  // then falls back to its built-in sample level).
  async init(): Promise<LevelLibrary> {
    const res = await this.fetch(ContentPaths.LEVELS_MANIFEST);
    if (!res.ok) throw new Error('failed to load level manifest');
    this.manifest = (await res.json()) as LevelManifestEntry[];
    this.migrate();
    return this;
  }

  // Bundled levels (flagged `modified` when they have a draft), then the
  // local levels.
  list(): LevelListItem[] {
    const fromManifest = this.manifest.map((m) => ({
      ...m,
      modified: this.storage.getItem(LevelLibrary.KEY.draft(m.id)) != null,
    }));
    const fromLocals = this.readLocals().map((l) => ({
      id: l.id,
      name: l.name,
      file: null,
      group: 'local',
      modified: false, // a local level's draft IS the level: nothing to differ from
    }));
    return [...fromManifest, ...fromLocals];
  }

  // A level's text — its draft if it has one, else the bundled file — and
  // make that text the new baseline.
  async load(id: string): Promise<string> {
    const text = await this.peek(id);
    this.baseline = text;
    return text;
  }

  // Like `load`, but leaves the baseline alone (downloading another level
  // from the dialog must not change what "unsaved" means).
  async peek(id: string): Promise<string> {
    const draft = this.storage.getItem(LevelLibrary.KEY.draft(id));
    if (LevelLibrary.isLocalId(id)) return draft ?? ''; // no original to fall back to
    return draft != null ? draft : await this.fetchOriginal(id);
  }

  // Save `text` as the draft of `id`; it becomes the baseline.
  save(id: string, text: string): void {
    this.storage.setItem(LevelLibrary.KEY.draft(id), text);
    this.baseline = text;
  }

  // Drop the draft and return the bundled text. A local level has no
  // bundled text, so it keeps its stored text instead.
  async revert(id: string): Promise<string> {
    let text: string;
    if (LevelLibrary.isLocalId(id)) {
      text = this.storage.getItem(LevelLibrary.KEY.draft(id)) ?? '';
    } else {
      this.storage.removeItem(LevelLibrary.KEY.draft(id));
      text = await this.fetchOriginal(id);
    }
    this.baseline = text;
    return text;
  }

  // Whether `text` differs from the text last loaded or saved.
  isDirty(text: string): boolean {
    return text !== this.baseline;
  }

  // The level open when the editor was last used.
  lastOpen(): string | null {
    return this.storage.getItem(LevelLibrary.KEY.lastOpen);
  }

  setLastOpen(id: string): void {
    this.storage.setItem(LevelLibrary.KEY.lastOpen, id);
  }

  // Store pasted text as a new local level; returns its new id.
  addLocal(text: string, name = 'untitled'): string {
    const id = `${LevelLibrary.LOCAL_PREFIX}${LevelLibrary.randomId(8)}`;
    this.storage.setItem(LevelLibrary.KEY.draft(id), text);
    this.writeLocals([...this.readLocals(), { id, name }]);
    return id;
  }

  removeLocal(id: string): void {
    if (!LevelLibrary.isLocalId(id)) return;
    this.storage.removeItem(LevelLibrary.KEY.draft(id));
    this.writeLocals(this.readLocals().filter((l) => l.id !== id));
  }

  // The tilesets manifest, fetched once. Offline or missing, it is [] and
  // callers offer just the default tileset.
  async tilesets(): Promise<TilesetManifestEntry[]> {
    if (this.tilesetList) return this.tilesetList;
    try {
      const res = await this.fetch(ContentPaths.TILESETS_MANIFEST);
      if (res.ok) this.tilesetList = (await res.json()) as TilesetManifestEntry[];
    } catch { /* offline: fall through to [] */ }
    return (this.tilesetList ??= []);
  }

  // One-shot import of the first version's single buffer as a draft of the
  // first level. The `migrated` flag makes it run once only.
  private migrate(): void {
    if (this.storage.getItem(LevelLibrary.KEY.migrated)) return;
    const legacy = this.storage.getItem(LevelLibrary.LEGACY_KEY);
    if (legacy != null && this.manifest.length) {
      const id = this.manifest[0].id;
      this.storage.setItem(LevelLibrary.KEY.draft(id), legacy);
      this.storage.setItem(LevelLibrary.KEY.lastOpen, id);
      this.storage.removeItem(LevelLibrary.LEGACY_KEY);
    }
    this.storage.setItem(LevelLibrary.KEY.migrated, '1');
  }

  private async fetchOriginal(id: string): Promise<string> {
    const entry = this.manifest.find((m) => m.id === id);
    if (!entry) throw new Error(`unknown level: ${id}`);
    const res = await this.fetch(ContentPaths.level(entry.file));
    if (!res.ok) throw new Error(`failed to load ${entry.file}`);
    return res.text();
  }

  private readLocals(): LocalLevelEntry[] {
    try {
      const raw = this.storage.getItem(LevelLibrary.KEY.locals);
      const list: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  private writeLocals(list: LocalLevelEntry[]): void {
    this.storage.setItem(LevelLibrary.KEY.locals, JSON.stringify(list));
  }

  // n random lower-case letters and digits (~10^12 ids for n = 8).
  private static randomId(n: number): string {
    const a = LevelLibrary.ID_ALPHABET;
    let out = '';
    for (let i = 0; i < n; i++) out += a[Math.floor(Math.random() * a.length)];
    return out;
  }
}
