import { defineConfig } from '@playwright/test';

// Diagnostic Playwright runs (visual screenshots, not assertion-only) — see
// tests/screenshots/. Boots the Vite dev server itself; reuses one already
// running locally so devs can iterate without thrash.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
