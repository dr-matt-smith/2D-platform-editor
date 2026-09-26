// Enforces the monorepo's dependency rules (README_architecture.md).
//
//   deno task check:deps
//
// Deno workspaces let any member import any other member by name, so the
// layering is checked here instead: every import in every .ts file must
// either stay inside its own package/app, or name a package that the
// importer is allowed to depend on. Apps are never imported by anything.

type Unit = string; // e.g. 'packages/engine', 'apps/editor'

// Who may import whom, by package name. Order = layering, lowest first.
const ALLOWED: Record<Unit, readonly string[]> = {
  'packages/level-format': [],
  'packages/render': ['@2d-platform/level-format'],
  // The engine implements the agent's PhysicsAdapter interface (type only).
  'packages/engine': ['@2d-platform/level-format', '@2d-platform/render', '@2d-platform/agent'],
  'packages/agent': [],
  'apps/editor': ['@2d-platform/level-format', '@2d-platform/render', '@2d-platform/engine', '@2d-platform/agent'],
  'apps/player': ['@2d-platform/level-format', '@2d-platform/render', '@2d-platform/engine'],
  'apps/agent-cli': ['@2d-platform/level-format', '@2d-platform/engine', '@2d-platform/agent'],
  // Generates the Python port's golden vectors from the JS engine + agent.
  'packages/agent-py': ['@2d-platform/level-format', '@2d-platform/engine', '@2d-platform/agent'],
};

// Tests may also use packages the code itself must not depend on: the
// agent's tests drive the real engine through its adapter.
const ALLOWED_IN_TESTS: Record<Unit, readonly string[]> = {
  'packages/agent': ['@2d-platform/engine', '@2d-platform/level-format'],
};

// Third-party imports mapped in the root deno.json, allowed everywhere.
const EXTERNAL = ['@std/', '@playwright/test', 'vite', 'node:', 'npm:', 'jsr:'];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.venv', '.git', '.vite', 'test-results']);

function* tsFiles(dir: string): Generator<string> {
  for (const entry of Deno.readDirSync(dir)) {
    const path = dir === '.' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
      yield* tsFiles(path);
    } else if (entry.isFile && path.endsWith('.ts')) {
      yield path;
    }
  }
}

function unitOf(path: string): Unit | null {
  const [top, name] = path.split('/');
  return (top === 'packages' || top === 'apps') && name ? `${top}/${name}` : null;
}

// Resolve a relative specifier against the importing file (posix paths).
function resolve(from: string, spec: string): string {
  const parts = from.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

// Static imports/exports and dynamic import() calls with a string literal.
const IMPORT = /(?:^|[\s;])(?:import|export)\b[^'"`;]*?from\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm;

const violations: string[] = [];
for (const file of tsFiles('.')) {
  const unit = unitOf(file);
  const isTest = /\.test\.ts$/.test(file);
  const isE2e = file.includes('/e2e/');
  const text = Deno.readTextFileSync(file);
  for (const m of text.matchAll(IMPORT)) {
    const spec = m[1] ?? m[2] ?? m[3];
    const line = text.slice(0, m.index).split('\n').length;
    const where = `${file}:${line}`;
    if (EXTERNAL.some((e) => spec.startsWith(e))) continue;
    // e2e specs import app modules inside the browser by URL ('/packages/...').
    if (isE2e && spec.startsWith('/')) continue;
    if (spec.startsWith('.')) {
      const target = resolve(file, spec);
      if (unitOf(target) !== unit) {
        violations.push(`${where}  relative import '${spec}' leaves ${unit ?? 'its folder'}; import the package by name instead`);
      }
      continue;
    }
    if (spec.startsWith('@2d-platform/')) {
      if (!unit) {
        violations.push(`${where}  '${spec}' imported from outside packages/ and apps/`);
        continue;
      }
      if (`packages/${spec.slice('@2d-platform/'.length)}` === unit) {
        violations.push(`${where}  a package importing itself by name ('${spec}'); use a relative import`);
        continue;
      }
      const ok = (ALLOWED[unit] ?? []).includes(spec) ||
        (isTest && (ALLOWED_IN_TESTS[unit] ?? []).includes(spec));
      if (!ok) violations.push(`${where}  ${unit} may not depend on '${spec}'`);
      continue;
    }
    violations.push(`${where}  unexpected import '${spec}'`);
  }
}

if (violations.length) {
  console.error(`Dependency rule violations (${violations.length}):\n  ${violations.join('\n  ')}`);
  Deno.exit(1);
}
console.log('check-boundaries: every import respects the package layering');
