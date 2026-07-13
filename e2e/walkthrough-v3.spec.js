import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* =========================================================================
   THE WALKTHROUGH v3 — the gate for feat/el-mundo-v3, run against the
   preview AS A USER, in real Chrome. The app comes alive:

   A · a VISUAL craft meets the conversational builder — three questions,
       a composed plan ("A VISUAL WORLD"), suggestion-seeded steps, publish,
       and the world live for an anonymous visitor.
   B · a SOUND craft proves the composition reorders — YOUR SOUND leads
       after the conversation, honest skips all the way to publish.
   C · CREATE central — the + opens the intentions, a post (image + line)
       lands in MOMENTS on the member's world and the public sees it.
       Pre-migration (0016 not applied) the composer shows the honest
       error — the story records that and moves on.
   D · event hosting stays gated — anon and a plain (non-verified) member
       are both refused by admin_save_event server-side; the public room
       /e/:slug renders the house event with an HONEST checkout (inert
       coming_soon tiers). The full verified-host story needs a founder-
       granted verified account + migration 0016 — listed for Pato's pass.
   E · desktop 1440, anonymous — the world (MOMENTS included), Discover,
       the landing, and /e/:slug as editorial spreads.

   Self-contained: makes its own accounts, appends them to accounts.jsonl
   for the cleanup pass, writes state-v3.json.
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v3'
const STATE_FILE = path.join(SHOTS, 'state-v3.json')
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

test('A · the builder KNOWS you first — visual craft, composed plan, publish', async ({ page }) => {
  const acct = await signUp(page, 'QA Visual')
  fs.writeFileSync(STATE_FILE, JSON.stringify({ a: acct }))

  // ---- the newborn world opens the CONVERSATION, not a form ----
  await page.goto('/profile')
  const sheet = page.getByRole('dialog', { name: 'Build your world' })
  await expect(sheet).toBeVisible({ timeout: 20000 })
  await expect(sheet.getByText('WHAT DO YOU MAKE?')).toBeVisible()
  await expect(sheet.getByText('getting to know you')).toBeVisible()
  await page.waitForTimeout(600)
  await shot(page, 'v3-01-meet-craft')

  // Q1 — the craft (persists on Next)
  await sheet.getByPlaceholder('DJ · Painter · Photographer · Writer…').fill('Photographer')
  await sheet.getByRole('button', { name: /Next/ }).click()

  // Q2 — the feel (seeds skin + welcome)
  await expect(sheet.getByText('WHAT SHOULD THEY FEEL?')).toBeVisible({ timeout: 15000 })
  await sheet.getByPlaceholder(/like walking into a warm room/).fill('like walking into a warm room')
  await shot(page, 'v3-02-meet-feel')
  await sheet.getByRole('button', { name: /Next/ }).click()

  // Q3 — what's real today
  await expect(sheet.getByText('READY TO SHOW TODAY?')).toBeVisible()
  await sheet.getByRole('button', { name: 'images of my work' }).click()
  await shot(page, 'v3-03-meet-show')
  await sheet.getByRole('button', { name: 'COMPOSE MY WORLD' }).click()

  // ---- the composed plan (kind is deterministic from the craft) ----
  await expect(sheet.getByText('A VISUAL WORLD')).toBeVisible({ timeout: 20000 })
  await expect(sheet.getByText('suggested skin')).toBeVisible()
  await shot(page, 'v3-04-composed-plan')
  await sheet.getByRole('button', { name: 'START BUILDING →' }).click()

  // ---- steps, in the composed order: line → work → doors → marquee → skin ----
  await expect(sheet.getByText('YOUR LINE', { exact: true }).first()).toBeVisible()
  await sheet.getByPlaceholder(/One line, your voice/).fill('light over everything')
  await shot(page, 'v3-05-step-line')
  await sheet.getByRole('button', { name: /Next/ }).click()

  await expect(sheet.getByText('THE WORK')).toBeVisible({ timeout: 15000 })
  const img = path.join(SHOTS, 'v3-01-meet-craft.png')
  const fileInput = sheet.locator('input[type=file]')
  for (let i = 0; i < 2; i++) {
    await fileInput.setInputFiles(img)
    await expect(sheet.locator('img')).toHaveCount(i + 1, { timeout: 30000 })
  }
  await shot(page, 'v3-06-step-work')
  await sheet.getByRole('button', { name: /Next/ }).click()

  await expect(sheet.getByText('THE DOORS')).toBeVisible({ timeout: 15000 })
  await sheet.getByRole('button', { name: /skip this step/ }).click()

  // marquee — seeded from the feel (or /api/curate); made the member's own
  await expect(sheet.getByText('THE MARQUEE')).toBeVisible()
  const marqueeInput = sheet.getByPlaceholder('wlcme 2 my wrld')
  await shot(page, 'v3-07-step-marquee-seeded')
  await marqueeInput.fill('qa marquee live')
  await sheet.getByRole('button', { name: /Next/ }).click()

  // skin — a suggestion is preselected; the member decides (pick Bone)
  await expect(sheet.getByText('THE SKIN')).toBeVisible()
  await sheet.getByRole('button', { name: 'Bone' }).click()
  await shot(page, 'v3-08-step-skin')
  await sheet.getByRole('button', { name: 'PUBLISH YOUR WORLD' }).click()

  // ---- celebration → the world, live, as the world sees it ----
  const celebration = page.getByRole('dialog', { name: 'Your world is live' })
  await expect(celebration).toBeVisible({ timeout: 20000 })
  await shot(page, 'v3-09-published')
  await page.getByRole('button', { name: 'SEE IT AS THE WORLD SEES IT' }).click()
  await page.waitForURL(`**/user/${acct.uid}`, { timeout: 15000 })
  await expect(page.getByText('QA MARQUEE LIVE').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('light over everything').first()).toBeVisible()
  await page.waitForTimeout(900)
  await shot(page, 'v3-10-world-live')
})

test('B · a DJ meets the composition — YOUR SOUND leads, skips stay honest', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const acct = await signUp(page, 'QA Sound')
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); st.b = acct
  fs.writeFileSync(STATE_FILE, JSON.stringify(st))

  await page.goto('/profile')
  const sheet = page.getByRole('dialog', { name: 'Build your world' })
  await expect(sheet).toBeVisible({ timeout: 20000 })
  await sheet.getByPlaceholder('DJ · Painter · Photographer · Writer…').fill('DJ & Producer')
  await sheet.getByRole('button', { name: /Next/ }).click()
  await expect(sheet.getByText('WHAT SHOULD THEY FEEL?')).toBeVisible({ timeout: 15000 })
  await sheet.getByPlaceholder(/like walking into a warm room/).fill('raw underground energy')
  await sheet.getByRole('button', { name: /Next/ }).click()
  await expect(sheet.getByText('READY TO SHOW TODAY?')).toBeVisible()
  await sheet.getByRole('button', { name: 'links where my stuff lives' }).click()
  await sheet.getByRole('button', { name: 'COMPOSE MY WORLD' }).click()

  await expect(sheet.getByText('A SOUND WORLD')).toBeVisible({ timeout: 20000 })
  await shot(page, 'v3-11-plan-sound')
  await sheet.getByRole('button', { name: 'START BUILDING →' }).click()

  // line first, then the craft-aware reorder: YOUR SOUND (doors) leads
  await expect(sheet.getByText('YOUR LINE', { exact: true }).first()).toBeVisible()
  await sheet.getByRole('button', { name: /skip this step/ }).click()
  await expect(sheet.getByText('YOUR SOUND', { exact: true }).first()).toBeVisible()
  await sheet.getByRole('button', { name: /Add a door/ }).click()
  await sheet.getByPlaceholder('SoundCloud').fill('SoundCloud')
  await sheet.getByPlaceholder('https://…').fill('https://soundcloud.com/thecollectiv4')
  await shot(page, 'v3-12-sound-leads')
  await sheet.getByRole('button', { name: /Next/ }).click()

  // the rest is guilt-free: skip to publish
  await expect(sheet.getByText('THE VISUALS')).toBeVisible({ timeout: 15000 })
  await sheet.getByRole('button', { name: /skip this step/ }).click()
  await expect(sheet.getByText('THE MARQUEE')).toBeVisible()
  await sheet.getByRole('button', { name: /skip this step/ }).click()
  await expect(sheet.getByText('THE SKIN')).toBeVisible()
  await sheet.getByRole('button', { name: 'PUBLISH YOUR WORLD' }).click()
  await expect(page.getByRole('dialog', { name: 'Your world is live' })).toBeVisible({ timeout: 20000 })
  await ctx.close()
})

test('C · CREATE central — a post becomes a dated MOMENT in the world', async ({ browser }) => {
  const { a } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()

  // sign back in as the visual world's owner (tab first — the submit shares its name)
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('Email').fill(a.email)
  await page.getByPlaceholder('Password').fill(a.password)
  await page.getByPlaceholder('Password').press('Enter')
  await page.waitForURL('**/', { timeout: 20000 })

  // the + sits at the CENTER of the nav (Ley 13)
  const createBtn = page.getByRole('button', { name: 'Create' })
  await expect(createBtn).toBeVisible({ timeout: 15000 })
  await shot(page, 'v3-13-create-in-nav')
  await createBtn.click()

  const modal = page.getByRole('dialog', { name: 'Create' })
  await expect(modal).toBeVisible()
  await expect(modal.getByText('POST TO YOUR WORLD')).toBeVisible()
  await expect(modal.getByText('CURATE YOUR WORLD')).toBeVisible()
  // a plain member sees NO event door — zero coming-soon teasers (Leyes 9/11)
  await expect(modal.getByText('HOST AN EVENT')).toHaveCount(0)
  // settle past the fade + backdrop-filter composite — a mid-fade capture
  // ghosts the layers (screenshot artifact, not a paint order bug)
  await page.waitForTimeout(900)
  await shot(page, 'v3-14-create-modal')
  await modal.getByText('POST TO YOUR WORLD').click()

  // the composer: one image + one line
  const shotFile = path.join(SHOTS, 'v3-13-create-in-nav.png')
  await modal.locator('input[type=file]').setInputFiles(shotFile)
  await expect(modal.locator('img')).toHaveCount(1, { timeout: 20000 })
  await modal.getByPlaceholder(/What is this moment/).fill('first moment in the world — qa')
  await page.waitForTimeout(700)
  await shot(page, 'v3-15-post-composer')
  await modal.getByRole('button', { name: 'POST IT' }).click()

  // two honest outcomes: posted (0016 live) or the pre-migration message
  const posted = modal.getByText('IT LIVES IN YOUR WORLD')
  const notYet = modal.getByText(/posting isn't switched on yet/i)
  await expect(posted.or(notYet)).toBeVisible({ timeout: 30000 })
  if (await notYet.isVisible().catch(() => false)) {
    test.info().annotations.push({ type: 'PENDING-MIGRATION', description: 'world_posts (0016) not applied — the composer answered honestly. Re-run after `supabase db push --linked`.' })
    await shot(page, 'v3-16-post-premigration-honest')
    await ctx.close()
    return
  }
  await shot(page, 'v3-16-posted')
  await modal.getByRole('button', { name: 'SEE IT IN YOUR WORLD' }).click()
  await page.waitForURL('**/profile', { timeout: 15000 })
  await expect(page.getByText('MOMENTS')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('first moment in the world — qa')).toBeVisible()
  await shot(page, 'v3-17-moments-own-world')

  // the public sees the moment too (RLS mirrors the world's visibility)
  const anon = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const anonPage = await anon.newPage()
  await anonPage.goto(`/user/${a.uid}`)
  await expect(anonPage.getByText('MOMENTS')).toBeVisible({ timeout: 20000 })
  await expect(anonPage.getByText('first moment in the world — qa')).toBeVisible()
  await shot(anonPage, 'v3-18-moments-public')
  await anon.close()
  await ctx.close()
})

test('D · event hosting stays gated server-side; /e/:slug is an honest room', async ({ browser, request }) => {
  const { a } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))

  // anon → refused at the door
  const anonTry = await request.post(`${SUPABASE_URL}/rest/v1/rpc/admin_save_event`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    data: { p: { title: 'x', slug: 'qa-hostile-v3' } },
  })
  const anonBody = await anonTry.json().catch(() => ({}))
  expect(JSON.stringify(anonBody)).toContain('not_member')

  // a plain signed-in member (not verified) → refused the same way
  const login = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    data: { email: a.email, password: a.password },
  })
  const session = await login.json()
  expect(session.access_token, 'login for gate test').toBeTruthy()
  const memberTry = await request.post(`${SUPABASE_URL}/rest/v1/rpc/admin_save_event`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    data: { p: { title: 'x', slug: 'qa-hostile-v3' } },
  })
  const memberBody = await memberTry.json().catch(() => ({}))
  expect(JSON.stringify(memberBody)).toContain('not_member')

  test.info().annotations.push({
    type: 'FOUNDER-PASS',
    description: 'Happy path del host verified (crear → publicar → /e/:slug → borrar) requiere una cuenta verified (grant de founder) + migración 0016. Checklist en el handback.',
  })

  // the public room: the house event by slug, checkout honest (tiers inert)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('/e/rba-edition-2')
  await expect(page.getByText('GET YOUR TICKET')).toBeVisible({ timeout: 20000 })
  await page.getByText('GET YOUR TICKET').click()
  await page.waitForTimeout(600)
  await shot(page, 'v3-19-event-room-honest')
  // a wrong slug answers honestly, never a broken spread
  await page.goto('/e/this-room-does-not-exist')
  await expect(page.getByText("THIS ROOM ISN'T OPEN")).toBeVisible({ timeout: 15000 })
  await ctx.close()
})

test('E · desktop 1440, anonymous — the app alive as an editorial spread', async ({ browser }) => {
  const { a } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  // the world — identity + marquee + (if posted) MOMENTS
  await page.goto(`/user/${a.uid}`)
  await expect(page.getByText('QA Visual').first()).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('banner').getByText('THE COLLECTIV4')).toBeVisible()
  // CREATE is present in the wide header (Ley 13)
  await expect(page.getByRole('banner').getByRole('button', { name: 'Create' })).toBeVisible()
  await page.waitForTimeout(1200)
  await shot(page, 'v3-20-desktop-world')
  await page.mouse.wheel(0, 900)
  await page.waitForTimeout(900)
  await shot(page, 'v3-21-desktop-world-body')

  // Discover — the sky, with the event cards linking to their own rooms
  await page.goto('/discover')
  await expect(page.getByRole('heading', { name: 'DISCOVER' })).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(1300)
  await shot(page, 'v3-22-desktop-discover')

  // the landing — the house event
  await page.goto('/')
  await expect(page.getByText('GET YOUR TICKET')).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(1100)
  await shot(page, 'v3-23-desktop-landing')

  // the public room by slug at width
  await page.goto('/e/rba-edition-2')
  await expect(page.getByText('GET YOUR TICKET')).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(1100)
  await shot(page, 'v3-24-desktop-event-room')

  await ctx.close()
})
