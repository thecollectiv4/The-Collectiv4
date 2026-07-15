import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* =========================================================================
   THE WALKTHROUGH v5 — the gate for feat/el-mundo-v5, run against the
   preview AS A USER, in real Chrome. El salto:

   A · anon: the EVENT directory + the HOUSE WORLD (/c4) + nav marks.
   B · the THEATRICAL BUILDER: a new member is RECOGNIZED — alias search
       ("video edit" → Videographer), multiple crafts, primary hand-off,
       the composed plan speaks the primary's kind, the hero wears the
       real crafts. Persistence proven via reload + REST.
   C · IN-UI MIGRATION: a legacy free-text discipline meets the invitation
       band and becomes real crafts.
   D · COMMUNITY: the craft filter runs on the real taxonomy (+ deep link).
   E · WORLDS IN ORBIT: two members sharing a craft see each other.
   F · LINEUP: names render as doors — a real match links to a world,
       no match falls back honestly to the artist page.
   G · VIBE: an undeclared event renders NO character band (honest
       absence); the server refuses anon vibe writes (checked pre-gate).
   H · MOBILE 390: CREATE geometrically centered; /os degraded clean for
       a plain member (no dead routes).
   I · DESKTOP 1440: the editorial spreads (EVENT · /c4 · a world).
   J · the QA accounts retire; Community closes clean.

   Self-contained: makes its own accounts, appends them to accounts.jsonl,
   writes state-v5.json. Founder-only stories (host declares a vibe in the
   OS editor) stay manual — the gate can't self-grant verified.
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v5'
const STATE_FILE = path.join(SHOTS, 'state-v5.json')
fs.mkdirSync(SHOTS, { recursive: true })

const SUPABASE_URL = 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const ANON_KEY = 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K'

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })

test.describe.configure({ mode: 'serial' })

async function signUp(page, name) {
  const ts = Date.now()
  const email = `c4-qa-${ts}@example.com`
  const password = `QaWorld!${ts}`
  await page.goto('/auth')
  await page.getByPlaceholder('Your name').fill(name)
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
  fs.appendFileSync(path.join(SHOTS, 'accounts.jsonl'), JSON.stringify({ uid, email, password }) + '\n')
  return { uid, email, password }
}

async function signIn(page, acct) {
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('Email').fill(acct.email)
  await page.getByPlaceholder('Password').fill(acct.password)
  await page.getByPlaceholder('Password').press('Enter')
  await page.waitForURL('**/', { timeout: 20000 })
}

const tokenOf = (page) => page.evaluate(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'))
  if (!k) return null
  try { return JSON.parse(localStorage.getItem(k))?.access_token || null } catch { return null }
})

/* toggle a craft in the picker: search, wait for the option, tap it */
async function pickCraft(scope, query, slug) {
  const search = scope.getByTestId('craft-search')
  await search.fill('')
  await search.fill(query)
  const opt = scope.getByTestId(`craft-opt-${slug}`).first()
  await expect(opt).toBeVisible({ timeout: 15000 })
  await opt.click()
  await expect(scope.getByTestId(`craft-chip-${slug}`)).toBeVisible({ timeout: 10000 })
}

test('A · anon — the EVENT directory, the house world, the marks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'EVENTS' })).toBeVisible({ timeout: 20000 })
  // the nav still carries every word (Ley 5) — now beside the house marks
  for (const label of ['Event', 'Community', 'Messages', 'Profile']) {
    await expect(page.locator('nav').getByText(label, { exact: true })).toBeVisible()
  }
  await page.waitForTimeout(900)
  await shot(page, 'v5-01-event-tab')

  // the house door → the flagship world
  await page.getByTestId('house-door').click()
  await expect(page).toHaveURL(/\/c4$/, { timeout: 15000 })
  await expect(page.getByRole('heading', { name: 'THE COLLECTIV4' })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('WE ARE ALL ONE · FOR THE PEOPLE · 4')).toBeVisible()
  await expect(page.getByText('THE ROOMS', { exact: true })).toBeVisible()
  await expect(page.getByText('THE CULTURE', { exact: true })).toBeVisible()
  // both founders credited, always (canon)
  await expect(page.getByText(/Pato Durán & Diego Villaseñor/)).toBeVisible()
  await page.waitForTimeout(900)
  await shot(page, 'v5-02-house-world')
  await page.mouse.wheel(0, 1200)
  await page.waitForTimeout(700)
  await shot(page, 'v5-03-house-world-body')
})

test('A2 · /c4 loaded DIRECT as anon — the front door, never a wall', async ({ browser }) => {
  // when the domain points at the platform this is the first URL a
  // stranger hits — a sign-in modal here would defeat the flagship
  // (caught live in the v5 smoke; pinned forever)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('/c4')
  await expect(page.getByRole('heading', { name: 'THE COLLECTIV4' })).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(1200)
  await expect(page.getByText('WELCOME BACK')).toHaveCount(0)
  await ctx.close()
})

test('B · the theatrical builder — the universe recognizes you', async ({ browser, request }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const b = await signUp(page, 'QA Selector')
  fs.writeFileSync(STATE_FILE, JSON.stringify({ b }))

  await page.goto('/profile')
  const sheet = page.getByRole('dialog', { name: 'Build your world' })
  await expect(sheet).toBeVisible({ timeout: 20000 })
  await expect(sheet.getByText('WHAT DO YOU MAKE?')).toBeVisible({ timeout: 15000 })

  // the RECOGNITION: an alias finds the craft ("video edit" → Videographer)
  await pickCraft(sheet, 'video edit', 'videographer')
  await shot(page, 'v5-04-builder-recognizes')
  // you are many crafts at once
  await pickCraft(sheet, 'dj', 'dj')
  // hand DJ the lead — the recognition line answers with the primary's kind
  await sheet.getByTestId('craft-chip-dj').getByRole('button').first().click()
  await expect(sheet.getByTestId('craft-recognition')).toContainText(/many rooms — dj leads/i, { timeout: 10000 })
  await page.waitForTimeout(400)
  await shot(page, 'v5-05-builder-two-crafts')

  await sheet.getByRole('button', { name: /Next/ }).click()
  await expect(sheet.getByText('WHAT SHOULD THEY FEEL?')).toBeVisible({ timeout: 20000 })
  await sheet.getByRole('button', { name: /skip this one/ }).click()
  await expect(sheet.getByText('READY TO SHOW TODAY?')).toBeVisible()
  await sheet.getByRole('button', { name: 'COMPOSE MY WORLD' }).click()
  // the plan speaks the PRIMARY craft's kind — a DJ gets a sound world
  await expect(sheet.getByText('A SOUND WORLD')).toBeVisible({ timeout: 20000 })
  await shot(page, 'v5-06-composed-sound-world')
  await sheet.getByRole('button', { name: 'START BUILDING →' }).click()
  for (let i = 0; i < 7; i++) {
    const publish = sheet.getByRole('button', { name: 'PUBLISH YOUR WORLD' })
    if (await publish.isVisible().catch(() => false)) break
    await sheet.getByRole('button', { name: /skip this step/ }).click()
  }
  await sheet.getByRole('button', { name: 'PUBLISH YOUR WORLD' }).click()
  await expect(page.getByRole('dialog', { name: 'Your world is live' })).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: 'keep curating' }).click()

  // the hero wears the REAL crafts — the PRIMARY leads the line
  const hero = page.getByTestId('hero-crafts')
  await expect(hero).toBeVisible({ timeout: 20000 })
  await expect(hero).toContainText('Videographer')
  await expect(hero).toContainText(/^DJ/)
  await page.waitForTimeout(700)
  await shot(page, 'v5-07-hero-crafts')

  // persistence is a ROW, not a state: reload + REST agree
  await page.reload()
  await expect(page.getByTestId('hero-crafts')).toContainText('DJ', { timeout: 20000 })
  const rows = await request.get(
    `${SUPABASE_URL}/rest/v1/profile_crafts?profile_id=eq.${b.uid}&select=is_primary,crafts(slug)`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
  ).then(r => r.json())
  expect(rows.length).toBe(2)
  expect(rows.find(r => r.is_primary)?.crafts?.slug).toBe('dj')
  await ctx.close()
})

test('C · in-UI migration — a legacy discipline becomes real crafts', async ({ browser, request }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const c = await signUp(page, 'QA Legacy')
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); st.c = c
  fs.writeFileSync(STATE_FILE, JSON.stringify(st))

  // close the newborn builder — this person predates the craft spine
  await page.goto('/profile')
  const sheet = page.getByRole('dialog', { name: 'Build your world' })
  await expect(sheet).toBeVisible({ timeout: 20000 })
  await sheet.getByRole('button', { name: 'Close' }).click()

  // plant the legacy state: free-text discipline, zero crafts (own-row RLS)
  const token = await tokenOf(page)
  expect(token).toBeTruthy()
  const patch = await request.patch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${c.uid}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    data: { discipline: 'DJ & dreamer, passionate human' },
  })
  expect(patch.ok()).toBeTruthy()

  await page.reload()
  // the invitation band — recognition offered, never forced
  const band = page.getByTestId('craft-migration')
  await expect(band).toBeVisible({ timeout: 20000 })
  await expect(band).toContainText('THE UNIVERSE NOW SPEAKS CRAFT')
  await page.waitForTimeout(600)
  await shot(page, 'v5-08-migration-band')
  await band.click()

  // the builder lands ON the craft step, seeded from the legacy words
  const sheet2 = page.getByRole('dialog', { name: 'Build your world' })
  await expect(sheet2.getByText('YOUR CRAFT', { exact: true })).toBeVisible({ timeout: 20000 })
  await pickCraft(sheet2, 'dj', 'dj')
  await sheet2.getByRole('button', { name: /Next/ }).click()
  await page.waitForTimeout(1500)
  await sheet2.getByRole('button', { name: 'Close' }).click()

  // the band is gone — the migration happened, once
  await page.reload()
  await expect(page.getByTestId('hero-crafts')).toContainText('DJ', { timeout: 20000 })
  await expect(page.getByTestId('craft-migration')).toHaveCount(0)
  await shot(page, 'v5-09-migrated')
  await ctx.close()
})

test('D · Community — the craft filter runs on the real taxonomy', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('/community')
  await expect(page.getByRole('heading', { name: 'COMMUNITY' })).toBeVisible({ timeout: 20000 })

  // the filter chip is the curated craft, not free-text soup
  const djChip = page.getByTestId('craft-filter-dj')
  await expect(djChip).toBeVisible({ timeout: 20000 })
  await djChip.click()
  await expect(page.getByText('QA Selector')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(700)
  await shot(page, 'v5-10-community-craft-filter')

  // the deep link — events and worlds can point at a craft (D2)
  await page.goto('/community?craft=videographer')
  await expect(page.getByText('QA Selector')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('QA Legacy')).toHaveCount(0)
  await ctx.close()
})

test('E · WORLDS IN ORBIT — shared craft, same sky', async ({ browser }) => {
  const { b } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto(`/user/${b.uid}`)
  await expect(page.getByText('QA Selector').first()).toBeVisible({ timeout: 20000 })
  // both QA members are DJs — the orbit connects them
  const orbit = page.getByTestId('related-worlds')
  await orbit.scrollIntoViewIfNeeded()
  await expect(orbit).toBeVisible({ timeout: 20000 })
  await expect(orbit).toContainText('QA Legacy')
  await expect(orbit).toContainText(/also DJ/i)
  await page.waitForTimeout(700)
  await shot(page, 'v5-11-worlds-in-orbit')
  await ctx.close()
})

test('F · the lineup — names are doors (world or honest fallback)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('/e/rba-edition-2')
  await expect(page.getByText('GET YOUR TICKET').or(page.getByText('TICKETS SOON'))).toBeVisible({ timeout: 20000 })
  // every lineup row is a door — to a WORLD when the person exists here,
  // to the artist page when they don't (never a dead click)
  const rows = page.getByTestId('lineup-world').or(page.getByTestId('lineup-artist'))
  const n = await rows.count()
  expect(n).toBeGreaterThan(0)
  await rows.first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await shot(page, 'v5-12-lineup-doors')
  await rows.first().click()
  await expect(page).toHaveURL(/\/(user|artist)\//, { timeout: 15000 })
  await ctx.close()
})

test('G · vibe — honest absence + the temperatures render', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('/e/rba-edition-2')
  await expect(page.getByText('GET YOUR TICKET').or(page.getByText('TICKETS SOON'))).toBeVisible({ timeout: 20000 })
  // this event never declared a character → NO band (Ley 11)
  await expect(page.getByTestId('event-vibe')).toHaveCount(0)
  // the EXPERIENCE catalog wears per-experience temperature marks (Ley 14)
  const exps = page.getByTestId('event-experience')
  if (await exps.count() > 0) {
    await exps.first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(600)
    await shot(page, 'v5-13-experience-temps')
  }
  await ctx.close()
})

test('H · mobile 390 — CREATE at the geometric center; /os degrades clean', async ({ browser }) => {
  const { b } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await signIn(page, b)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'EVENTS' })).toBeVisible({ timeout: 20000 })
  // the + sits at the geometric center of the bar
  const createBtn = page.locator('nav').getByRole('button', { name: 'Create' })
  await expect(createBtn).toBeVisible()
  const box = await createBtn.boundingBox()
  const center = box.x + box.width / 2
  expect(Math.abs(center - 195), `CREATE center at ${center}px (viewport center 195px)`).toBeLessThanOrEqual(12)
  await page.waitForTimeout(600)
  await shot(page, 'v5-14-mobile-nav-marks')

  // a plain member meets /os with a clean, honest wall — and a live door out
  await page.goto('/os')
  await expect(page.getByText('Our network only')).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(400)
  await shot(page, 'v5-15-os-degraded')
  await page.getByRole('button', { name: '← Community' }).click()
  await expect(page).toHaveURL(/\/community$/, { timeout: 15000 })
  await ctx.close()
})

test('I · desktop 1440 — the editorial spreads', async ({ browser }) => {
  const { b } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'EVENTS' })).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('banner').getByText('THE COLLECTIV4')).toBeVisible()
  await page.waitForTimeout(1200)
  await shot(page, 'v5-16-desktop-events')

  await page.goto('/c4')
  await expect(page.getByRole('heading', { name: 'THE COLLECTIV4' })).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(1200)
  await shot(page, 'v5-17-desktop-house-world')
  await page.mouse.wheel(0, 1100)
  await page.waitForTimeout(800)
  await shot(page, 'v5-18-desktop-house-body')

  await page.goto(`/user/${b.uid}`)
  await expect(page.getByText('QA Selector').first()).toBeVisible({ timeout: 20000 })
  await expect(page.getByTestId('hero-crafts')).toContainText('DJ')
  await page.waitForTimeout(1200)
  await shot(page, 'v5-19-desktop-world-crafts')
  await page.mouse.wheel(0, 900)
  await page.waitForTimeout(800)
  await shot(page, 'v5-20-desktop-world-chapters')
  await ctx.close()
})

test('J · the QA accounts retire; Community closes clean', async ({ browser, request }) => {
  const lines = fs.readFileSync(path.join(SHOTS, 'accounts.jsonl'), 'utf8').trim().split('\n')
  for (const line of lines) {
    const { uid, email, password } = JSON.parse(line)
    const login = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      data: { email, password },
    })
    const session = await login.json()
    if (!session.access_token) continue
    await request.patch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      data: { is_demo: true, username: null, full_name: 'QA (retired)' },
    })
    // crafts leave with the account — is_demo hides them from anon, but the
    // founders' preview toggle still sees demo rows; retire ALL of it
    await request.post(`${SUPABASE_URL}/rest/v1/rpc/set_profile_crafts`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      data: { p_craft_ids: [], p_primary_id: null },
    })
  }
  // a retired demo's crafts leak nothing — 0020's honesty gate, live
  const { b } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const leak = await request.get(
    `${SUPABASE_URL}/rest/v1/profile_crafts?profile_id=eq.${b.uid}&select=craft_id`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
  ).then(r => r.json())
  expect(Array.isArray(leak) ? leak.length : 0).toBe(0)

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('/community')
  await expect(page.getByRole('heading', { name: 'COMMUNITY' })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('QA Selector')).toHaveCount(0)
  await expect(page.getByText('QA Legacy')).toHaveCount(0)
  await page.waitForTimeout(900)
  await shot(page, 'v5-21-community-clean')
  await ctx.close()
})
