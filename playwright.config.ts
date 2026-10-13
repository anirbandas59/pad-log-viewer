// Browser tests of the built app. M4 runs them against `vite preview`; M8 adds file://.
// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use an installed Chromium instead of a downloaded one.
import { defineConfig } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined },
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/pad-log-viewer.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
