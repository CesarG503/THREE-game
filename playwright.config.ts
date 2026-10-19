import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: { channel: process.env.PLAYWRIGHT_CHANNEL, baseURL: 'http://127.0.0.1:4178', viewport: { width: 1280, height: 800 }, screenshot: 'only-on-failure', trace: { mode: 'retain-on-failure', screenshots: false }, launchOptions: { args: ['--enable-unsafe-swiftshader'] } },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4178 --strictPort', url: 'http://127.0.0.1:4178', reuseExistingServer: true },
  reporter: [['list'], ['html', { open: 'never' }]],
});
