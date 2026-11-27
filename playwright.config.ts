import { defineConfig } from '@playwright/test';

const PORT = 4173;

/**
 * End-to-end tests against the production build in `dist/`, served by `vite preview`.
 * Run `npm run build` first (or use `npm run test:e2e`, which does both).
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    hasTouch: true,
    viewport: { width: 400, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
