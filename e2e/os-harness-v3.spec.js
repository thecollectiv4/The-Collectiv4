import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* =========================================================================
   OS INSTRUMENT — v3 visual pass, against the DEV harness (/__os-harness,
   mirror data, DEV-only route). The real /os is verified-gated; this spec
   verifies the INSTRUMENT itself: the rail's semantic icons + labels, the
   per-section light temperature, the directional pane slides, and the
   Brain's YOUR TODAY landing (probe mocked online — the endpoint's own
   degradation is a server concern, tested separately).

   Run explicitly against a local dev server:
     HARNESS_URL=http://localhost:5173 npx playwright test e2e/os-harness-v3.spec.js
   ========================================================================= */

const HARNESS = process.env.HARNESS_URL || ''
const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v3'
fs.mkdirSync(SHOTS, { recursive: true })
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })

test.describe.configure({ mode: 'serial' })
test.skip(!HARNESS, 'HARNESS_URL not set — instrument pass runs against local dev only')

test('the instrument: rail, temperature, slides, YOUR TODAY', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  // the Brain probes /api/assistant — mock it ONLINE so the landing renders
  // (vite dev serves no /api functions; the endpoint is a Vercel concern)
  await page.route('**/api/assistant', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"available":true}' }))

  await page.goto(`${HARNESS}/__os-harness`)
  await expect(page.getByText('TEAM OS')).toBeVisible({ timeout: 20000 })

  // full rail: semantic icons + words + codes; board is home
  await expect(page.getByRole('button', { name: 'The Brain', exact: false }).first()).toBeVisible()
  await page.waitForTimeout(900)
  await shot(page, 'v3-os-01-board-1440')

  // pane slide right → Content (warm temperature)
  await page.getByRole('button', { name: 'Content' }).first().click()
  await page.waitForTimeout(1100)
  await shot(page, 'v3-os-02-content-temp')

  // The Brain — YOUR TODAY from the mirror board, chips born from real items
  await page.getByRole('button', { name: 'The Brain' }).first().click()
  await expect(page.getByText('DAYS TO FALL 001')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('this week', { exact: false }).first()).toBeVisible()
  // a chip born from a real board item — never a generic starter
  await expect(page.getByText(/what's the move on "/).first()).toBeVisible()
  await page.waitForTimeout(1100)
  await shot(page, 'v3-os-03-brain-your-today')

  // Events pane
  await page.getByRole('button', { name: 'Events', exact: true }).first().click()
  await page.waitForTimeout(900)
  await shot(page, 'v3-os-04-events')

  await ctx.close()

  // icon-only rail (~1000px): icons at a dignified size, every mark worded
  const narrow = await browser.newContext({ viewport: { width: 1000, height: 800 } })
  const npage = await narrow.newPage()
  await npage.route('**/api/assistant', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"available":true}' }))
  await npage.goto(`${HARNESS}/__os-harness`)
  await expect(npage.getByText('Board').first()).toBeVisible({ timeout: 20000 })
  await npage.waitForTimeout(900)
  await shot(npage, 'v3-os-05-icon-rail-1000')
  await narrow.close()
})
