import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// v29 M5: resolve the @2d-platform/agent workspace package to its
// source entry. npm workspaces also symlink it into node_modules, but
// an explicit alias makes dev + build resolution deterministic
// regardless of install state (and keeps the Playwright dev server
// resolving the bare specifier main.js imports).
export default defineConfig({
  resolve: {
    alias: {
      '@2d-platform/agent': fileURLToPath(
        new URL('./packages/agent/src/index.js', import.meta.url),
      ),
    },
  },
});
