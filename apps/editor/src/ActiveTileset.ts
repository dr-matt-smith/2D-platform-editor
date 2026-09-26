import { Legend, Level, Severity } from '@2d-platform/level-format';
import type { ValidationIssue } from '@2d-platform/level-format';
import { Tileset } from '@2d-platform/render';
import type { TileLookup } from '@2d-platform/render';
import { ContentPaths } from './ContentPaths.ts';

declare global {
  interface Window {
    // Test hook: the active tileset, set once one has loaded, so specs
    // can wait for it before pressing Play.
    __activeTileset?: Tileset | null;
  }
}

// One loaded tileset and what the editor derives from it.
export interface LoadedTileset {
  tileset: Tileset;
  legend: Legend;
  // Folder that legend thumbnails resolve against.
  base: string;
  // False when the tileset's lookup could not be loaded.
  ok: boolean;
}

// The tileset the open level uses (its `# tileset:` line), with the legend
// built from it. Tilesets load lazily and are cached by id, so switching
// back to one never refetches.
//
// Before the first load it holds the default legend and no tileset, so
// the first paint needs no network. A tileset that fails to load falls
// back to the default legend and adds a warning to the problems list.
export class ActiveTileset {
  private readonly cache = new Map<string, Promise<LoadedTileset>>();
  private activeId: string | null = null;
  private current: Tileset | null = null;
  private currentLegend: Legend = Legend.DEFAULT;
  private currentBase = ContentPaths.tilesetFolder(Level.DEFAULT_TILESET);
  private currentWarning: ValidationIssue | null = null;

  get tileset(): Tileset | null {
    return this.current;
  }

  get legend(): Legend {
    return this.currentLegend;
  }

  // The tileset's `tile_lookup.json`, if it has one.
  get lookup(): TileLookup | null {
    return this.current?.lookup ?? null;
  }

  // Folder legend thumbnails resolve against.
  get thumbnailBase(): string {
    return this.currentBase;
  }

  // A warning to show with the level's issues, or null.
  get warning(): ValidationIssue | null {
    return this.currentWarning;
  }

  // Make tileset `id` the active one. Resolves true if it changed (the
  // legend panel then needs redrawing). Cheap when unchanged, so it is
  // safe to call on every edit.
  async sync(id: string): Promise<boolean> {
    if (id === this.activeId) return false;
    const loaded = await this.load(id);
    this.activeId = id;
    this.current = loaded.tileset;
    this.currentLegend = loaded.legend;
    this.currentBase = loaded.base;
    if (typeof window !== 'undefined') window.__activeTileset = loaded.tileset;
    // Only warn when a level names a set that failed; a failed *default*
    // (offline) quietly draws fallback shapes, as it always has.
    this.currentWarning = !loaded.ok && id !== Level.DEFAULT_TILESET
      ? { line: 1, col: 1, severity: Severity.Warn, message: `unknown tileset '${id}', using default` }
      : null;
    return true;
  }

  private load(id: string): Promise<LoadedTileset> {
    let pending = this.cache.get(id);
    if (!pending) {
      pending = Tileset.load(id).then((tileset) => {
        const ok = !!tileset.lookup;
        return {
          tileset,
          legend: ok ? Legend.fromLookup(tileset.lookup) : Legend.DEFAULT,
          // The fallback legend's images are Dirt's, so its thumbnails
          // must resolve against Dirt's folder.
          base: ContentPaths.tilesetFolder(ok ? id : Level.DEFAULT_TILESET),
          ok,
        };
      });
      this.cache.set(id, pending);
    }
    return pending;
  }
}
