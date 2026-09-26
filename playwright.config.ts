import { defineConfig } from '@playwright/test';

// End-to-end specs for the browser apps live beside each app, in
// apps/<app>/e2e/ (diagnostic screenshots go to apps/<app>/e2e/screenshots/).
// Boots the Vite dev server itself; reuses one already running locally so
// devs can iterate without thrash.
export default defineConfig({
  testDir: './apps',
  testMatch: '*/e2e/**/*.spec.ts',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'deno task dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
