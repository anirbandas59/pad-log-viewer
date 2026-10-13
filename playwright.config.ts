// Browser tests of the built app, run twice: served by `vite preview` (http://localhost), and
// opened from disk (file://), the way reviewers open the shipped HTML.
// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use an installed Chromium instead of a downloaded one.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined },
  },
  projects: [
    { name: 'preview', use: { baseURL: `http://localhost:${PORT}/` } },
    { name: 'file', use: { baseURL: `${pathToFileURL(resolve('dist')).href}/` } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/pad-log-viewer.html`,
    // Always build and serve fresh: a reused server may still serve an older build.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
