import { defineConfig, devices } from '@playwright/test';

// pnpm shot 用。主な画面のスクリーンショットを screenshots/ に保存する（合否の判定はしない）
// テストの wrangler dev（8789）と同時に動かせるよう、ポートを分けている
const PORT = 8790;

export default defineConfig({
  testDir: './shots',
  outputDir: './test-results/shots',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'block',
  },
  // 16:10 のノート PC の画面
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `wrangler dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
