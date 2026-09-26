// Build tooling — NOT part of the app bundle.
// Scans content/data/tilesets/*/tile_lookup.json and writes a tilesets
// manifest so the editor can offer tileset choices (content/ is not
// directory-listable). Runs as part of `deno task gen`, a dependency of
// `deno task dev`/`build`, so it cannot go stale.
// No consumer until v8 (the tileset chooser); v7 ships the data layer.
const TILESETS_DIR = `${import.meta.dirname}/../content/data/tilesets`;

interface TilesetEntry {
  id: string;
  name: string;
}

const entries = Array.from(Deno.readDirSync(TILESETS_DIR), (e) => e.name)
  .filter((d) => Deno.statSync(`${TILESETS_DIR}/${d}`).isDirectory)
  .map((id): TilesetEntry | null => {
    const lookupPath = `${TILESETS_DIR}/${id}/tile_lookup.json`;
    let name = id;
    try {
      const lookup: { name?: string } = JSON.parse(Deno.readTextFileSync(lookupPath));
      name = lookup.name || id;
    } catch {
      return null; // a dir without a valid tile_lookup.json is not a tileset
    }
    return { id, name };
  })
  .filter((e): e is TilesetEntry => e !== null)
  .sort((a, b) => a.id.localeCompare(b.id));

Deno.writeTextFileSync(
  `${TILESETS_DIR}/manifest.json`,
  JSON.stringify(entries, null, 2) + '\n',
);
console.log(`gen-tilesets-manifest: ${entries.length} tileset(s)`);
