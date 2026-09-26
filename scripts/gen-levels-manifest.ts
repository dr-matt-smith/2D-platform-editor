// Build tooling — NOT part of the app bundle.
// Scans public/data/levels/*.txt and writes manifest.json so the in-app
// level loader can enumerate levels (public/ is not directory-listable).
// Runs as part of `deno task gen`, a dependency of `deno task dev`/`build`,
// so it cannot go stale.
const LEVELS_DIR = `${import.meta.dirname}/../public/data/levels`;

interface Header {
  name: string | null;
  order: number | null;
}

// Mirror level.js's directive shape; a wall row ("####") never matches.
const DIRECTIVE = /^#\s*(\w+)\s*:\s*(.+?)\s*$/;
const isComment = (l: string): boolean => l.trimStart().startsWith('//');

// Read header directives until the grid starts. `order` controls load order
// (lower first); absent → sorts after ordered levels, then by filename.
function readHeader(text: string): Header {
  const h: Header = { name: null, order: null };
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (isComment(line)) continue;
    const m = line.match(DIRECTIVE);
    if (!m) break; // first non-comment, non-directive line → grid started
    const key = m[1].toLowerCase();
    if (key === 'name') h.name = m[2];
    else if (key === 'order' && /^\d+$/.test(m[2])) h.order = Number(m[2]);
  }
  return h;
}

const entries = Array.from(Deno.readDirSync(LEVELS_DIR), (e) => e.name)
  .filter((f) => f.endsWith('.txt'))
  .map((file) => {
    const { name, order } = readHeader(
      Deno.readTextFileSync(`${LEVELS_DIR}/${file}`),
    );
    return { id: file.replace(/\.txt$/, ''), name: name || file, file, order };
  });

// Stable total order: (order ?? 999, filename). Manifest entry shape stays
// { id, name, file } — `order` only influences array position.
entries.sort(
  (a, b) =>
    (a.order ?? 999) - (b.order ?? 999) || a.file.localeCompare(b.file),
);
const manifest = entries.map(({ id, name, file }) => ({ id, name, file }));

Deno.writeTextFileSync(
  `${LEVELS_DIR}/manifest.json`,
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(`gen-levels-manifest: ${manifest.length} levels`);
