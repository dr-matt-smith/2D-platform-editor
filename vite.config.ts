import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// One static site hosts both browser apps, so they share one copy of the
// game content:
//   /                landing page (index.html)
//   /apps/editor/    the level editor
//   /apps/player/    the standalone player
//   /data/...        levels, tilesets and audio, served from content/
//
// Vite doesn't read Deno's workspace, so each package's bare name is
// aliased to its entry point (the same `exports` its deno.json declares).
const pkg = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  publicDir: 'content',
  resolve: {
    alias: {
      '@2d-platform/level-format': pkg('level-format'),
      '@2d-platform/render': pkg('render'),
      '@2d-platform/engine': pkg('engine'),
      '@2d-platform/agent': pkg('agent'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        editor: fileURLToPath(new URL('./apps/editor/index.html', import.meta.url)),
        player: fileURLToPath(new URL('./apps/player/index.html', import.meta.url)),
      },
    },
  },
});
