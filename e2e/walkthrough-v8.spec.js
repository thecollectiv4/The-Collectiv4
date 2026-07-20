import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* =========================================================================
   THE WALKTHROUGH v8 — EL COSMOS. The gate for feat/el-mundo-v8, run
   against the preview (or local dev) in real Chrome + the LIVE remote DB.

   A · ONE sky — a single shared canvas behind every surface (never the
       old per-page mounts), the film grain riding above everything.
   B · the sky BREATHES — canvas pixels move over time… and under
       prefers-reduced-motion they DON'T (apagado total, non-negotiable).
   C · CREATE is three doors (○ SHARE · ◇ GATHER · △ OFFER) — and honest:
       a non-verified member's GATHER holds no HOST AN EVENT.
   D · the seed is invisible (0033): anon AND a fresh authed session read
       zero is_demo rows; Community shows no seed pill to non-owners.
   E · the galaxy doesn't cost the phone — rAF cadence at 390px stays
       above 25fps on the DENSE surface.
   F · retire the QA account.
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v8'
fs.mkdirSync(SHOTS, { recursive: true })

const SUPABASE_URL = 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const ANON_KEY = 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K'

test.describe.configure({ mode: 'serial' })

const rest = (request, pathname, opts = {}) => request.fetch(`${SUPABASE_URL}${pathname}`, {
  method: opts.method || 'GET',
  headers: { apikey: ANON_KEY, Authorization: `Bearer ${opts.token || ANON_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  data: opts.data,
})

const grabToken = (page) => page.evaluate(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'))
  try { return k ? JSON.parse(localStorage.getItem(k))?.access_token || null : null } catch { return null }
})
const grabUid = (page) => page.evaluate(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'))
  try { return k ? JSON.parse(localStorage.getItem(k))?.user?.id || null : null } catch { return null }
})

/* ---------------- A · one sky, one grain, every room ---------------- */
test('A · one shared canvas behind every surface + the grain above all', async ({ page }) => {
  for (const route of ['/', '/community', '/messages', '/c4']) {
    await page.goto(route)
    await page.waitForTimeout(600)
    const canvases = await page.locator('canvas').count()
    expect(canvases, `${route} must carry exactly ONE sky canvas`).toBe(1)
  }
  // the grain: one fixed layer at the deck's 5%, above the page
  const grain = await page.evaluate(() => {
    const divs = [...document.querySelectorAll('div')]
    return divs.some(d => {
      const s = getComputedStyle(d)
      return s.position === 'fixed' && Math.abs(parseFloat(s.opacity) - 0.05) < 0.011 && s.backgroundImage.includes('svg') && s.pointerEvents === 'none'
    })
  })
  expect(grain, 'the film grain layer (feTurbulence, 5%) must ride over the app').toBe(true)
  await page.screenshot({ path: path.join(SHOTS, 'a-c4-sky.png') })
})

/* ---------------- B · the sky breathes — and shuts off ---------------- */
test('B1 · the constellation drifts (pixels move over time)', async ({ page }) => {
  await page.goto('/c4')
  await page.waitForTimeout(800)
  const f1 = await page.evaluate(() => document.querySelector('canvas')?.toDataURL())
  await page.waitForTimeout(900)
  const f2 = await page.evaluate(() => document.querySelector('canvas')?.toDataURL())
  expect(f1, 'canvas must paint').toBeTruthy()
  expect(f1 === f2, 'the sky must MOVE when motion is allowed').toBe(false)
})

test.describe('B2 · prefers-reduced-motion — apagado total', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })
  test('the sky holds perfectly still', async ({ page }) => {
    await page.goto('/c4')
    await page.waitForTimeout(800)
    const f1 = await page.evaluate(() => document.querySelector('canvas')?.toDataURL())
    await page.waitForTimeout(900)
    const f2 = await page.evaluate(() => document.querySelector('canvas')?.toDataURL())
    expect(f1, 'canvas still paints the void (no flash)').toBeTruthy()
    expect(f1 === f2, 'under reduced-motion NOTHING moves').toBe(true)
  })
})

/* ---------------- C · CREATE — the three doors ---------------- */
test('C · sign up, open CREATE: three doors, honest per member', async ({ page }) => {
  const ts = Date.now()
  const email = `c4-qa-v8-${ts}@example.com`
  const password = `QaV8!${ts}`
  await page.goto('/auth')
  /* ⚠ THIS TEST SIGNS UP A REAL ACCOUNT. When the v12 early-access gate is
     switched on (app_flags.invite_gate = true, migration 0046), open signup
     stops existing and this whole spec fails at this line — correctly, that
     is the gate working. Before flipping the flag: either mint a QA invite
     code and fill it here, or skip this spec. Do not "fix" it by weakening
     the gate. */
  await page.getByPlaceholder('First name').fill('Cosmos')
  await page.getByPlaceholder('Last name').fill(`QA${ts}`)
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Create Account' }).click()
  await page.waitForURL('**/', { timeout: 20000 })
  const uid = await grabUid(page)
  expect(uid, 'NO_SESSION_AFTER_SIGNUP').toBeTruthy()
  fs.appendFileSync(path.join(SHOTS, 'accounts-v8.jsonl'), JSON.stringify({ uid, email, password }) + '\n')

  await page.goto('/')
  await page.getByRole('button', { name: 'Create' }).first().click()

  /* v12 — ONE SCREEN. The v8 flow was menu → door → action; this section
     used to click into each door. The doors are now GROUPS whose actions are
     all visible immediately, so the assertions moved from "the door opens"
     to "the action is reachable without opening anything". The create-door-*
     testids survive on the group wrappers, so the grouping is still proven. */
  await expect(page.getByTestId('create-door-share')).toBeVisible({ timeout: 10000 })
  await expect(page.getByTestId('create-door-gather')).toBeVisible()
  await expect(page.getByTestId('create-door-offer')).toBeVisible()
  await page.screenshot({ path: path.join(SHOTS, 'c-create-menu.png') })

  // every action is on screen at once — no door to open first
  await expect(page.getByTestId('create-action-post-to-your-world')).toBeVisible()
  await expect(page.getByTestId('create-action-curate-your-world')).toBeVisible()
  await expect(page.getByTestId('create-action-make-a-plan')).toBeVisible()

  // a non-verified member still does NOT get HOST AN EVENT (honest absence,
  // Leyes 9/11) — unchanged by the redesign, and the reason it is asserted here
  await expect(page.getByTestId('create-action-host-an-event')).toHaveCount(0)

  // and the fastest path is one tap: CREATE → the composer
  await page.getByTestId('create-action-post-to-your-world').click()
  await expect(page.getByPlaceholder(/what is this moment/i)).toBeVisible()
  // Back returns to the menu (v12 rewired this: the intermediate 'share'
  // stage no longer exists, and Back pointed at it)
  await page.getByRole('dialog', { name: 'Create' }).getByRole('button', { name: /create/i }).first().click()
  await expect(page.getByTestId('create-action-post-to-your-world')).toBeVisible()
  await page.screenshot({ path: path.join(SHOTS, 'c-create-menu-back.png') })
})

/* ---------------- D · the seed is invisible (0033) ----------------
   Honest scope (review catch): a fresh QA account is UNVERIFIED, so this
   proves the anon + authed floors — not the verified-member invariant
   itself (no owner credentials exist in the gate to mint a verified
   session, correctly). The verified case is proven at the schema layer:
   0033/0034 are applied to the remote (supabase migration list) and the
   live policy text carries no caller_is_verified branch for demo rows. */
test('D · zero is_demo rows for anon AND for a fresh session; no pill', async ({ page, request }) => {
  // anon floor
  const anon = await (await rest(request, '/rest/v1/profiles?select=username&is_demo=eq.true&limit=5')).json()
  expect(Array.isArray(anon) ? anon.length : -1, 'anon reads ZERO seed rows').toBe(0)

  // authed (non-owner) floor — the v8 fix: authenticated ≠ seed access
  const file = path.join(SHOTS, 'accounts-v8.jsonl')
  const acct = JSON.parse(fs.readFileSync(file, 'utf8').trim().split('\n')[0])
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('Email').fill(acct.email)
  await page.getByPlaceholder('Password').fill(acct.password)
  await page.getByPlaceholder('Password').press('Enter')
  await page.waitForURL('**/', { timeout: 20000 })
  const token = await grabToken(page)
  expect(token).toBeTruthy()
  const authed = await (await rest(request, '/rest/v1/profiles?select=username&is_demo=eq.true&limit=5', { token })).json()
  expect(Array.isArray(authed) ? authed.length : -1, 'an authed session reads ZERO seed rows').toBe(0)

  // the surface: Community shows real worlds, never the seed pill, to a member
  await page.goto('/community?view=everyone')
  await page.waitForTimeout(1500)
  await expect(page.getByTestId('seed-visible-pill')).toHaveCount(0)
  await page.screenshot({ path: path.join(SHOTS, 'd-community-real.png') })
})

/* ---------------- E · the galaxy doesn't cost the phone ---------------- */
test('E · rAF cadence at 390px on the DENSE surface stays above 25fps', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/c4')
  await page.waitForTimeout(700)
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0
    let t0 = 0
    const loop = (t) => {
      if (!t0) t0 = t
      n++
      if (t - t0 < 2000) requestAnimationFrame(loop)
      else res(Math.round(n / ((t - t0) / 1000)))
    }
    requestAnimationFrame(loop)
  }))
  fs.appendFileSync(path.join(SHOTS, 'fps.txt'), `c4-390px: ${fps}fps\n`)
  expect(fps, `dense sky at 390px measured ${fps}fps`).toBeGreaterThanOrEqual(25)
})

/* ---------------- F · retire the QA account ---------------- */
test('F · retire the v8 QA account', async ({ page }) => {
  const file = path.join(SHOTS, 'accounts-v8.jsonl')
  if (!fs.existsSync(file)) return
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
  for (const line of lines) {
    const acct = JSON.parse(line)
    await page.goto('/auth')
    await page.getByRole('button', { name: 'Sign In' }).first().click()
    await page.getByPlaceholder('Email').fill(acct.email)
    await page.getByPlaceholder('Password').fill(acct.password)
    await page.getByPlaceholder('Password').press('Enter')
    await page.waitForURL('**/', { timeout: 20000 })
    const token = await grabToken(page)
    if (token && acct.uid) {
      // retire within the account's OWN RLS row (0033 keeps self-read/self-update)
      await page.request.fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${acct.uid}`, {
        method: 'PATCH',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        data: { is_demo: true, username: null, full_name: 'QA (retired v8)' },
      })
    }
  }
  fs.rmSync(file, { force: true })
})
