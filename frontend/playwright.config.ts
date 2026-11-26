import { defineConfig, devices } from '@playwright/test'

// PW_PORT lets parallel worktrees run the suite side by side without sharing a dev server.
const port = Number(process.env.PW_PORT ?? 5174)

// Browser checks for the Rift / Classic interfaces. Every /api call is mocked in the tests,
// so this needs only the Vite dev server, not Flask or MariaDB.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    ...devices['Desktop Chrome'],
    // Cloud sessions have a pre-installed Chromium that may not match the pinned Playwright.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
