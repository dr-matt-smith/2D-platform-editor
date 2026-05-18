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

function readName(text) {
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (isComment(line)) continue;
    const m = line.match(DIRECTIVE);
    if (!m) break; // first non-comment, non-directive line → grid started
    if (m[1].toLowerCase() === 'name') return m[2];
  }
  return null;
}

const files = readdirSync(LEVELS_DIR)
  .filter((f) => f.endsWith('.txt'))
  .sort();

const manifest = files.map((file) => {
  const id = file.replace(/\.txt$/, '');
  const name = readName(readFileSync(join(LEVELS_DIR, file), 'utf8')) || id;
  return { id, name, file };
});

writeFileSync(
  join(LEVELS_DIR, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(`gen-levels-manifest: ${manifest.length} levels`);
