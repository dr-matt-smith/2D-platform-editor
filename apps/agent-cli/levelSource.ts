// Loading levels and legends from disk. The editor fetches the same files
// over HTTP; here we read them directly, so no DOM or network is needed.
import { buildLegend, DEFAULT_LEGEND, DEFAULT_TILESET, parse } from '@2d-platform/level-format';
import type { GlyphLookup, Legend, ParsedLevel } from '@2d-platform/level-format';

/** One entry of levels/manifest.json. */
export interface ManifestEntry {
  id: string;
  name: string;
  file: string;
  group?: string;
}

/** A level's text plus where it came from. */
export interface LevelSource {
  /** The manifest id, or null for a level given as a file path. */
  id: string | null;
  path: string;
  text: string;
}

/** A level ready to solve: parsed, with its tileset's legend. */
export interface PreparedLevel extends LevelSource {
  parsed: ParsedLevel;
  legend: Legend;
  tilesetWarning: string | null;
}

/** The legend to solve with, plus a warning if the tileset was unusable. */
export interface LoadedLegend {
  legend: Legend;
  warning: string | null;
}

/** A missing or unreadable input. main.ts prints the message and exits with 2. */
export class InputError extends Error {
  override name = 'InputError';
}

export async function readManifest(contentDir: string): Promise<ManifestEntry[]> {
  const path = `${contentDir}/levels/manifest.json`;
  const text = await readText(path, `level manifest not found: ${path}`);
  const entries: unknown = JSON.parse(text);
  if (!Array.isArray(entries) || !entries.every(isManifestEntry)) {
    throw new InputError(`${path} is not a list of { id, name, file } entries`);
  }
  return entries;
}

/** A bundled level from its manifest entry. */
export async function loadBundledLevel(entry: ManifestEntry, contentDir: string): Promise<LevelSource> {
  const path = `${contentDir}/levels/${entry.file}`;
  const text = await readText(path, `level file for '${entry.id}' not found: ${path}`);
  return { id: entry.id, path, text };
}

/**
 * Resolve the CLI's <level> argument. Anything that looks like a path
 * (ends in .txt or contains a slash) is read as a file; anything else is
 * looked up by id in the manifest.
 */
export async function resolveLevel(ref: string, contentDir: string): Promise<LevelSource> {
  if (looksLikePath(ref)) {
    const text = await readText(ref, `level file not found: ${ref}`);
    return { id: null, path: ref, text };
  }
  const manifest = await readManifest(contentDir);
  const entry = manifest.find((e) => e.id === ref);
  if (!entry) {
    const ids = manifest.map((e) => e.id).join(', ');
    throw new InputError(`no bundled level with id '${ref}' (available: ${ids})`);
  }
  return loadBundledLevel(entry, contentDir);
}

/**
 * The glyph legend for a tileset, built from its tile_lookup.json exactly
 * as the editor does. An unknown tileset falls back to DEFAULT_LEGEND with
 * a warning (none for the default tileset itself, matching the editor).
 */
export async function loadLegend(tilesetId: string, contentDir: string): Promise<LoadedLegend> {
  const path = `${contentDir}/tilesets/${tilesetId}/tile_lookup.json`;
  let lookup: GlyphLookup | null = null;
  try {
    const parsed: unknown = JSON.parse(await Deno.readTextFile(path));
    // Unvalidated JSON, as in the editor: buildLegend skips malformed glyphs.
    if (isObject(parsed)) lookup = parsed as GlyphLookup;
  } catch {
    // Missing or malformed lookup: fall through to the default legend.
  }
  if (lookup) return { legend: buildLegend(lookup), warning: null };
  const warning = tilesetId === DEFAULT_TILESET ? null : `unknown tileset '${tilesetId}', using default`;
  return { legend: DEFAULT_LEGEND, warning };
}

/** Parse a level and load the legend for the tileset it declares. */
export async function prepareLevel(source: LevelSource, contentDir: string): Promise<PreparedLevel> {
  const parsed = parse(source.text);
  const { legend, warning } = await loadLegend(parsed.meta.tileset, contentDir);
  return { ...source, parsed, legend, tilesetWarning: warning };
}

function looksLikePath(ref: string): boolean {
  return ref.endsWith('.txt') || ref.includes('/') || ref.includes('\\');
}

async function readText(path: string, notFoundMessage: string): Promise<string> {
  try {
    return await Deno.readTextFile(path);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) throw new InputError(notFoundMessage);
    throw new InputError(`cannot read ${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isManifestEntry(value: unknown): value is ManifestEntry {
  return isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.file === 'string';
}
