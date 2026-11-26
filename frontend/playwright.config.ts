import { defineConfig, devices } from '@playwright/test'

// PW_PORT lets parallel worktrees run the suite side by side without sharing a dev server.
const port = Number(process.env.PW_PORT ?? 5174)
// The Discord feedback link only shows when this is set, so the suite sets it. Workers inherit it, so tests can read it.
// A reused server keeps its own environment; feedbackUrlServed (e2e/mock.ts) reports that case.
process.env.VITE_DISCORD_FEEDBACK_URL ??= 'https://discord.gg/arena-feedback-e2e'

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
    env: { VITE_DISCORD_FEEDBACK_URL: process.env.VITE_DISCORD_FEEDBACK_URL },
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
