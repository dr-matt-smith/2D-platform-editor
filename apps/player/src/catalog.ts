// Level catalog: read the bundled levels manifest and fetch level text.
//
// `fetch` and the site base URL are passed in, so everything here runs
// headless under `deno test` as well as in the browser.

// One level from content/data/levels/manifest.json.
export interface LevelEntry {
  id: string;
  name: string;
  file: string;
  group?: string;
}

// A run of consecutive levels sharing a group (`null` = ungrouped).
export interface LevelGroup {
  group: string | null;
  levels: LevelEntry[];
}

// The subset of `fetch` the catalog needs.
export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface Catalog {
  levels: LevelEntry[];
  find(id: string): LevelEntry | undefined;
  loadText(entry: LevelEntry): Promise<string>;
}

const isString = (v: unknown): v is string => typeof v === 'string';

// Keep only well-formed manifest entries, so a hand-edited manifest with a
// bad row degrades to a shorter list instead of a broken page.
export function parseManifest(json: unknown): LevelEntry[] {
  if (!Array.isArray(json)) return [];
  const levels: LevelEntry[] = [];
  for (const row of json) {
    if (typeof row !== 'object' || row === null) continue;
    const { id, name, file, group } = row as Record<string, unknown>;
    if (!isString(id) || !isString(file)) continue;
    const entry: LevelEntry = { id, name: isString(name) ? name : id, file };
    if (isString(group) && group !== '') entry.group = group;
    levels.push(entry);
  }
  return levels;
}

// Split the list into runs of the same group, keeping manifest order.
export function groupLevels(levels: LevelEntry[]): LevelGroup[] {
  const groups: LevelGroup[] = [];
  for (const level of levels) {
    const group = level.group ?? null;
    const last = groups.at(-1);
    if (last && last.group === group) last.levels.push(level);
    else groups.push({ group, levels: [level] });
  }
  return groups;
}

// The level to open: the requested id if it exists, else the first level.
export function pickLevelId(levels: LevelEntry[], requested: string | null): string | null {
  if (requested && levels.some((l) => l.id === requested)) return requested;
  return levels[0]?.id ?? null;
}

// `base` is the site's base URL ('/' in dev, '/2D-platform-editor/' on Pages).
export async function loadCatalog(fetch: FetchLike, base: string): Promise<Catalog> {
  const res = await fetch(`${base}data/levels/manifest.json`);
  if (!res.ok) throw new Error('Could not load the level list.');
  const levels = parseManifest(await res.json());

  return {
    levels,
    find: (id) => levels.find((l) => l.id === id),
    async loadText(entry) {
      const res = await fetch(`${base}data/levels/${entry.file}`);
      if (!res.ok) throw new Error(`Could not load level "${entry.name}".`);
      return res.text();
    },
  };
}
