import { Legend, Level } from '@2d-platform/level-format';
import type { GlyphLookup } from '@2d-platform/level-format';
import { DenoFileReader } from './DenoFileReader.ts';
import { InputError } from './InputError.ts';
import type { FileReader } from './FileReader.ts';
import type { LevelFile } from './LevelFile.ts';
import type { LoadedLegend } from './LoadedLegend.ts';
import type { ManifestEntry } from './ManifestEntry.ts';
import type { PreparedLevel } from './PreparedLevel.ts';

// A content folder on disk (`levels/` and `tilesets/`, as in content/data):
// finds levels by id or path and loads the legend of a level's tileset.
//
// The editor fetches the same files over HTTP; here they are read through
// an injected FileReader, so no DOM or network is needed and tests can
// pass a fake.
export class ContentStore {
  constructor(
    readonly contentDir: string,
    private readonly files: FileReader = new DenoFileReader(),
  ) {}

  // The bundled levels, in manifest order.
  async readManifest(): Promise<ManifestEntry[]> {
    const path = `${this.contentDir}/levels/manifest.json`;
    const text = await this.readText(path, `level manifest not found: ${path}`);
    const entries: unknown = JSON.parse(text);
    if (!Array.isArray(entries) || !entries.every(ContentStore.isManifestEntry)) {
      throw new InputError(`${path} is not a list of { id, name, file } entries`);
    }
    return entries;
  }

  // A bundled level from its manifest entry.
  async loadBundled(entry: ManifestEntry): Promise<LevelFile> {
    const path = `${this.contentDir}/levels/${entry.file}`;
    const text = await this.readText(path, `level file for '${entry.id}' not found: ${path}`);
    return { id: entry.id, path, text };
  }

  // Resolve the CLI's <level> argument. Anything that looks like a path
  // (ends in .txt or contains a slash) is read as a file; anything else is
  // looked up by id in the manifest.
  async resolve(ref: string): Promise<LevelFile> {
    if (ContentStore.looksLikePath(ref)) {
      const text = await this.readText(ref, `level file not found: ${ref}`);
      return { id: null, path: ref, text };
    }
    const manifest = await this.readManifest();
    const entry = manifest.find((e) => e.id === ref);
    if (!entry) {
      const ids = manifest.map((e) => e.id).join(', ');
      throw new InputError(`no bundled level with id '${ref}' (available: ${ids})`);
    }
    return this.loadBundled(entry);
  }

  // The glyph legend for a tileset, built from its tile_lookup.json exactly
  // as the editor does. An unknown tileset falls back to Legend.DEFAULT with
  // a warning (none for the default tileset itself, matching the editor).
  async loadLegend(tilesetId: string): Promise<LoadedLegend> {
    const path = `${this.contentDir}/tilesets/${tilesetId}/tile_lookup.json`;
    let lookup: GlyphLookup | null = null;
    try {
      const parsed: unknown = JSON.parse(await this.files.readTextFile(path));
      // Unvalidated JSON, as in the editor: Legend.fromLookup skips malformed glyphs.
      if (ContentStore.isObject(parsed)) lookup = parsed as GlyphLookup;
    } catch {
      // Missing or malformed lookup: fall through to the default legend.
    }
    if (lookup) return { legend: Legend.fromLookup(lookup), warning: null };
    const warning = tilesetId === Level.DEFAULT_TILESET ? null : `unknown tileset '${tilesetId}', using default`;
    return { legend: Legend.DEFAULT, warning };
  }

  // Parse a level and load the legend for the tileset it declares.
  async prepare(file: LevelFile): Promise<PreparedLevel> {
    const parsed = Level.parse(file.text);
    const { legend, warning } = await this.loadLegend(parsed.meta.tileset);
    return { ...file, parsed, legend, tilesetWarning: warning };
  }

  // Read a file, turning any failure into an InputError the CLI can report.
  private async readText(path: string, notFoundMessage: string): Promise<string> {
    try {
      return await this.files.readTextFile(path);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) throw new InputError(notFoundMessage);
      throw new InputError(`cannot read ${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private static looksLikePath(ref: string): boolean {
    return ref.endsWith('.txt') || ref.includes('/') || ref.includes('\\');
  }

  private static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private static isManifestEntry(value: unknown): value is ManifestEntry {
    return ContentStore.isObject(value) &&
      typeof value.id === 'string' &&
      typeof value.name === 'string' &&
      typeof value.file === 'string';
  }
}
