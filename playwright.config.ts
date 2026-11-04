import { defineConfig, devices } from '@playwright/test';

const PORT = 8789;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Service Worker のキャッシュでテスト中のページが古くならないようにする
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  // File System Access API は Chromium にしかない
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `wrangler dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
