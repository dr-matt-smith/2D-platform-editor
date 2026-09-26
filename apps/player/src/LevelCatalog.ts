import type { LevelEntry } from './LevelEntry.ts';
import type { LevelFetch } from './LevelFetch.ts';
import type { LevelGroup } from './LevelGroup.ts';

// The bundled levels: the list from the levels manifest, and the text of
// each level on demand.
//
// `fetch` and the site base URL are passed in, so everything here runs
// headless under `deno test` as well as in the browser.
export class LevelCatalog {
  // `base` is the site's base URL ('/' in dev, '/2D-platform-editor/' on Pages).
  constructor(
    readonly levels: readonly LevelEntry[],
    private readonly fetch: LevelFetch,
    private readonly base: string,
  ) {}

  // Fetch the manifest and build the catalog from it.
  static async load(fetch: LevelFetch, base: string): Promise<LevelCatalog> {
    const res = await fetch(`${base}data/levels/manifest.json`);
    if (!res.ok) throw new Error('Could not load the level list.');
    return new LevelCatalog(LevelCatalog.parseManifest(await res.json()), fetch, base);
  }

  // Keep only well-formed manifest entries, so a hand-edited manifest with a
  // bad row degrades to a shorter list instead of a broken page.
  static parseManifest(json: unknown): LevelEntry[] {
    if (!Array.isArray(json)) return [];
    const levels: LevelEntry[] = [];
    for (const row of json) {
      if (typeof row !== 'object' || row === null) continue;
      const { id, name, file, group } = row as Record<string, unknown>;
      if (!LevelCatalog.isString(id) || !LevelCatalog.isString(file)) continue;
      const entry: LevelEntry = { id, name: LevelCatalog.isString(name) ? name : id, file };
      if (LevelCatalog.isString(group) && group !== '') entry.group = group;
      levels.push(entry);
    }
    return levels;
  }

  // The level with this id, if there is one.
  find(id: string): LevelEntry | undefined {
    return this.levels.find((l) => l.id === id);
  }

  // The levels split into runs of the same group, keeping manifest order.
  groups(): LevelGroup[] {
    const groups: LevelGroup[] = [];
    for (const level of this.levels) {
      const group = level.group ?? null;
      const last = groups.at(-1);
      if (last && last.group === group) last.levels.push(level);
      else groups.push({ group, levels: [level] });
    }
    return groups;
  }

  // The level to open: the requested id if it exists, else the first
  // level, or null when the catalog is empty.
  pick(requested: string | null): string | null {
    if (requested && this.levels.some((l) => l.id === requested)) return requested;
    return this.levels[0]?.id ?? null;
  }

  // Fetch a level's text.
  async loadText(entry: LevelEntry): Promise<string> {
    // Called unbound: the browser's fetch throws if `this` is not the window.
    const fetch = this.fetch;
    const res = await fetch(`${this.base}data/levels/${entry.file}`);
    if (!res.ok) throw new Error(`Could not load level "${entry.name}".`);
    return res.text();
  }

  private static isString(value: unknown): value is string {
    return typeof value === 'string';
  }
}
