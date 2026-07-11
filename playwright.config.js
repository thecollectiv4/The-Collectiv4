// Playwright config — the QA walkthrough gate (runs against the Vercel
// preview, PREVIEW_URL env). Serial: the walkthrough is one user's story.
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.PREVIEW_URL || 'http://localhost:5173',
    viewport: { width: 390, height: 844 },   // the app is mobile-first (430px frame)
    screenshot: 'off',                        // we take our own, named per step
    video: 'off',
  },
  reporter: [['list']],
})
