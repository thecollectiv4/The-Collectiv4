import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* =========================================================================
   THE WALKTHROUGH v2 — the gate for feat/el-mundo-v2, run against the
   preview AS A USER, in real Chrome. Adds to the v1 stories:

   C · a SOUND craft (DJ) builds their world — the builder reorganizes:
       craft → YOUR SOUND (links lead) → THE VISUALS → marquee → skin →
       publish. Proves the craft-aware order + the guilt-free skip.
   D · DESKTOP (1440px, the P1): an anonymous visitor sees the world as an
       editorial spread — wide header, museum salon grid, constellation
       canvas — on /user, /discover and the landing.

   Self-contained: makes its own account, writes its own state file
   (state-v2.json) for the runner's cleanup pass.
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough'
const STATE_FILE = path.join(SHOTS, 'state-v2.json')
fs.mkdirSync(SHOTS, { recursive: true })

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })

test.describe.configure({ mode: 'serial' })

test('C · a DJ builds a sound-first world (craft-aware builder + skip)', async ({ page }) => {
  const ts = Date.now()
  const email = `c4-qa-${ts}@example.com`
  const password = `QaWorld!${ts}`

  // ---- sign up ----
  await page.goto('/auth')
  await page.getByPlaceholder('Your name').fill('QA Sound')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Create Account' }).click()
  await page.waitForURL('**/', { timeout: 20000 })
  const uid = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'))
    if (!k) return null
    try { return JSON.parse(localStorage.getItem(k))?.user?.id || null } catch { return null }
  })
  expect(uid, 'NO_SESSION_AFTER_SIGNUP — email confirmation may be ON').toBeTruthy()
  fs.writeFileSync(STATE_FILE, JSON.stringify({ uid, email, password }))
  // accounts.jsonl accumulates across runs — a failed run must never orphan
  // its QA account beyond the cleanup script's reach
  fs.appendFileSync(path.join(SHOTS, 'accounts.jsonl'), JSON.stringify({ uid, email, password }) + '\n')

  // ---- the newborn world opens the builder ----
  await page.goto('/profile')
  const sheet = page.getByRole('dialog', { name: 'Build your world' })
  await expect(sheet).toBeVisible({ timeout: 20000 })
  await expect(sheet.getByText('YOUR CRAFT')).toBeVisible()
  await page.waitForTimeout(700)

  // step 1 — a SOUND craft: the builder announces the sound-first path
  await sheet.getByPlaceholder('DJ · Painter · Photographer…').fill('DJ & Producer')
  await sheet.getByPlaceholder("One line, your voice — what you're on right now.").fill('sets that tell stories')
  await expect(sheet.getByText('a sound world — your links will lead')).toBeVisible()
  await shot(page, 'v2-01-craft-dj')
  await sheet.getByRole('button', { name: /Next/ }).click()

  // step 2 — YOUR SOUND leads (doors before work — the craft-aware reorder)
  await expect(sheet.getByText('YOUR SOUND', { exact: true })).toBeVisible({ timeout: 15000 })
  await sheet.getByRole('button', { name: /Add a door/ }).click()
  await sheet.getByPlaceholder('SoundCloud').fill('SoundCloud')
  await sheet.getByPlaceholder('https://…').fill('https://soundcloud.com/thecollectiv4')
  await shot(page, 'v2-02-your-sound-leads')
  await sheet.getByRole('button', { name: /Next/ }).click()

  // step 3 — THE VISUALS (work, reframed for a DJ) → two real images
  await expect(sheet.getByText('THE VISUALS')).toBeVisible({ timeout: 15000 })
  await expect(sheet.getByText('tap · drag it in · or just paste')).toBeVisible()
  const img = path.join(SHOTS, 'v2-01-craft-dj.png')
  const fileInput = sheet.locator('input[type=file]')
  for (let i = 0; i < 2; i++) {
    await fileInput.setInputFiles(img)
    await expect(sheet.locator('img')).toHaveCount(i + 1, { timeout: 30000 })
  }
  await shot(page, 'v2-03-visuals-two-pieces')
  await sheet.getByRole('button', { name: /Next/ }).click()

  // step 4 — THE MARQUEE → the guilt-free skip (nothing written)
  await expect(sheet.getByText('THE MARQUEE')).toBeVisible({ timeout: 15000 })
  await shot(page, 'v2-04-marquee-before-skip')
  await sheet.getByRole('button', { name: /skip this step/ }).click()

  // step 5 — THE SKIN → PUBLISH
  await expect(sheet.getByText('THE SKIN')).toBeVisible()
  await sheet.getByRole('button', { name: 'Chrome' }).click()
  await shot(page, 'v2-05-skin')
  await sheet.getByRole('button', { name: 'PUBLISH YOUR WORLD' }).click()

  // ---- celebration → the world, live ----
  const celebration = page.getByRole('dialog', { name: 'Your world is live' })
  await expect(celebration).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(700)
  await shot(page, 'v2-06-published')
  await page.getByRole('button', { name: 'SEE IT AS THE WORLD SEES IT' }).click()
  await page.waitForURL(`**/user/${uid}`, { timeout: 15000 })
  // skipped marquee → the house default runs (null = default, honest)
  await expect(page.getByText('WLCME 2 MY WRLD').first()).toBeVisible({ timeout: 15000 })
  await shot(page, 'v2-07-sound-world-live')
})

test('D · desktop is an editorial spread, not a stretched phone (anon, 1440px)', async ({ browser }) => {
  const { uid } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  // ---- the world, wide: wide header + hero + the sound door + the wall ----
  await page.goto(`/user/${uid}`)
  // /user is public now — no sign-in wall for a shared world link
  await expect(page.getByText('QA Sound').first()).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('WLCME 2 MY WRLD').first()).toBeVisible()
  // the wide header (desktop nav) is present; the phone tab bar is not
  await expect(page.getByRole('banner').getByText('THE COLLECTIV4')).toBeVisible()
  // the constellation canvas is mounted behind the page
  expect(await page.locator('canvas').count()).toBeGreaterThan(0)
  await page.waitForTimeout(1200)
  await shot(page, 'v2-08-desktop-world-hero')
  await page.mouse.wheel(0, 700)
  await page.waitForTimeout(1200)
  // the salon grid hangs the two pieces (asymmetric spans, catalog numbers)
  await expect(page.locator('a.salon-piece').first()).toBeVisible()
  await expect(page.getByText('GALLERY')).toBeVisible()
  await shot(page, 'v2-09-desktop-world-salon')
  // no edit affordances for a stranger
  await expect(page.getByText('Build your world')).toHaveCount(0)

  // ---- Discover, wide: the sky of worlds ----
  await page.goto('/discover')
  await expect(page.getByRole('heading', { name: 'DISCOVER' })).toBeVisible({ timeout: 20000 })
  expect(await page.locator('canvas').count()).toBeGreaterThan(0)
  await page.waitForTimeout(1500)
  const firstCard = page.locator('.disc-card').first()
  if (await firstCard.count()) await firstCard.hover()
  await page.waitForTimeout(900)
  await shot(page, 'v2-10-desktop-discover-sky')

  // ---- the landing, wide ----
  await page.goto('/')
  await expect(page.getByText('GET YOUR TICKET')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('ARTISTS').first()).toBeVisible()
  await page.waitForTimeout(1200)
  await shot(page, 'v2-11-desktop-landing')

  await ctx.close()
})
