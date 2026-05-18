// Build tooling — NOT part of the app bundle.
// Scans public/data/tilesets/*/tile_lookup.json and writes a tilesets
// manifest so the editor can offer tileset choices (public/ is not
// directory-listable). Wired as predev/prebuild so it cannot go stale.
// No consumer until v8 (the tileset chooser); v7 ships the data layer.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TILESETS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'data',
  'tilesets',
);

const entries = readdirSync(TILESETS_DIR)
  .filter((d) => statSync(join(TILESETS_DIR, d)).isDirectory())
  .map((id) => {
    const lookupPath = join(TILESETS_DIR, id, 'tile_lookup.json');
    let name = id;
    try {
      name = JSON.parse(readFileSync(lookupPath, 'utf8')).name || id;
    } catch {
      return null; // a dir without a valid tile_lookup.json is not a tileset
    }
    return { id, name };
  })
  .filter(Boolean)
  .sort((a, b) => a.id.localeCompare(b.id));

writeFileSync(
  join(TILESETS_DIR, 'manifest.json'),
  JSON.stringify(entries, null, 2) + '\n',
);
console.log(`gen-tilesets-manifest: ${entries.length} tileset(s)`);
