import { test } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* v8 capture pass — the judges' evidence. Anon surfaces, two architectures
   (desktop 1440 / mobile 390), saved straight into the vault. Not a gate. */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-v8-captures'
fs.mkdirSync(SHOTS, { recursive: true })
const PATO = 'c255c33b-60d5-4e53-a81a-2f89d7f5ad1b'

const SURFACES = [
  ['events', '/'],
  ['house', '/c4'],
  ['community', '/community?view=everyone'],
  ['museum', `/user/${PATO}`],
  ['editions', '/editions'],
]

test.describe.configure({ mode: 'serial' })

for (const [name, route] of SURFACES) {
  test(`capture ${name} desktop`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(route)
    await page.waitForTimeout(2500)
    await page.screenshot({ path: path.join(SHOTS, `${name}-desktop.png`) })
  })
  test(`capture ${name} mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(route)
    await page.waitForTimeout(2500)
    await page.screenshot({ path: path.join(SHOTS, `${name}-mobile.png`) })
  })
}

test('capture house scrolled (the culture section)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/c4')
  await page.waitForTimeout(1500)
  await page.mouse.wheel(0, 1800)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(SHOTS, 'house-desktop-scrolled.png') })
})
