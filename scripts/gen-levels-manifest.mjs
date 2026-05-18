// Build tooling — NOT part of the app bundle.
// Scans public/data/levels/*.txt and writes manifest.json so the in-app
// level loader can enumerate levels (public/ is not directory-listable).
// Wired as predev/prebuild in package.json so it cannot go stale.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVELS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'data',
  'levels',
);

// Mirror level.js's directive shape; a wall row ("####") never matches.
const DIRECTIVE = /^#\s*(\w+)\s*:\s*(.+?)\s*$/;
const isComment = (l) => l.trimStart().startsWith('//');

// Read header directives until the grid starts. `order` controls load order
// (lower first); absent → sorts after ordered levels, then by filename.
function readHeader(text) {
  const h = { name: null, order: null };
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

const entries = readdirSync(LEVELS_DIR)
  .filter((f) => f.endsWith('.txt'))
  .map((file) => {
    const { name, order } = readHeader(
      readFileSync(join(LEVELS_DIR, file), 'utf8'),
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

writeFileSync(
  join(LEVELS_DIR, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(`gen-levels-manifest: ${manifest.length} levels`);
