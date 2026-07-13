import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* =========================================================================
   THE WALKTHROUGH v4 — the gate for feat/el-mundo-v4, run against the
   preview AS A USER, in real Chrome. El ecosistema despierta:

   A · the RE-ARCHITECTURE (anon): / is the EVENT directory, COMMUNITY is
       people (public), MESSAGES guards its door, Discover redirects clean.
   B · two members sign up; CREATE central shows the ecosystem's doors
       (Post · Sell · Offer · Curate — NO event door for plain members).
   C · FOLLOW — member B walks into A's world and connects.
   D · DM — B messages A; A finds the conversation in Messages.
   E · THE OFFER — B lists a piece with a real price; the public sees the
       price and the DM-to-buy door opens a real conversation.
   F · POST regression — the v3 loop stays alive (moments).
   G · EVENT GATES regression — hosting refused server-side for anon +
       plain member; /e/:slug honest; the room chat refuses non-holders.
   H · DESKTOP 1440 — the ecosystem as an editorial spread.

   DUAL-MODE (the v3 precedent): the social/marketplace stories depend on
   migration 0017, which PATO runs. Pre-migration the spec asserts the
   HONEST DEGRADATION (no dead doors, human words); post-migration the
   same spec verifies the full loops. Mode is detected live via REST.

   Self-contained: makes its own accounts, appends them to accounts.jsonl
   for the cleanup pass, writes state-v4.json.
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v4'
const STATE_FILE = path.join(SHOTS, 'state-v4.json')
fs.mkdirSync(SHOTS, { recursive: true })

const SUPABASE_URL = 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const ANON_KEY = 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K'

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })

test.describe.configure({ mode: 'serial' })

/* is the social layer (0017) live in the DB? */
async function socialLive(request) {
  const r = await request.get(`${SUPABASE_URL}/rest/v1/follows?limit=0`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  })
  return r.ok()
}

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

/* the world builder greets a newborn world on /profile — settle it fast
   so later stories can walk the museum (publish with all skips). */
async function publishBareWorld(page, craft) {
  await page.goto('/profile')
  const sheet = page.getByRole('dialog', { name: 'Build your world' })
  await expect(sheet).toBeVisible({ timeout: 20000 })
  await sheet.getByPlaceholder('DJ · Painter · Photographer · Writer…').fill(craft)
  await sheet.getByRole('button', { name: /Next/ }).click()
  await expect(sheet.getByText('WHAT SHOULD THEY FEEL?')).toBeVisible({ timeout: 15000 })
  await sheet.getByRole('button', { name: /skip this one/ }).click()
  await expect(sheet.getByText('READY TO SHOW TODAY?')).toBeVisible()
  await sheet.getByRole('button', { name: 'images of my work' }).click()
  await sheet.getByRole('button', { name: 'COMPOSE MY WORLD' }).click()
  await expect(sheet.getByRole('button', { name: 'START BUILDING →' })).toBeVisible({ timeout: 20000 })
  await sheet.getByRole('button', { name: 'START BUILDING →' }).click()
  // skip every step to the skin, then publish
  for (let i = 0; i < 6; i++) {
    const publish = sheet.getByRole('button', { name: 'PUBLISH YOUR WORLD' })
    if (await publish.isVisible().catch(() => false)) break
    await sheet.getByRole('button', { name: /skip this step/ }).click()
  }
  await sheet.getByRole('button', { name: 'PUBLISH YOUR WORLD' }).click()
  await expect(page.getByRole('dialog', { name: 'Your world is live' })).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: 'keep curating' }).click()
}

test('A · the re-architecture, walked as an anonymous visitor', async ({ page }) => {
  // EVENT — the directory of rooms lives at the root
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'EVENTS' })).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(900)
  await shot(page, 'v4-01-event-tab')

  // the new nav: EVENT · COMMUNITY · CREATE · MESSAGES · PROFILE
  for (const label of ['Event', 'Community', 'Messages', 'Profile']) {
    await expect(page.locator('nav').getByText(label, { exact: true })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Create' })).toBeVisible()

  // COMMUNITY — people, public, no wall
  await page.goto('/community')
  await expect(page.getByRole('heading', { name: 'COMMUNITY' })).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(900)
  await shot(page, 'v4-02-community-tab')

  // DISCOVER dissolves clean — never a 404
  await page.goto('/discover')
  await expect(page).toHaveURL(/\/community$/, { timeout: 15000 })
  await expect(page.getByRole('heading', { name: 'COMMUNITY' })).toBeVisible()

  // /chat (old address) → Messages
  await page.goto('/chat')
  await expect(page).toHaveURL(/\/messages$/, { timeout: 15000 })

  // MESSAGES guards its door for anon (sign-in surface, not a dead page)
  await expect(page.getByText('YOUR CONVERSATIONS LIVE HERE')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(600)
  await shot(page, 'v4-03-messages-anon-door')
})

test('B · two members arrive; CREATE central shows the ecosystem doors', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const a = await signUp(page, 'QA Seller')
  await publishBareWorld(page, 'Photographer')
  fs.writeFileSync(STATE_FILE, JSON.stringify({ a }))

  // the + opens the intentions — the business map in one button
  await page.goto('/')
  const createBtn = page.getByRole('button', { name: 'Create' })
  await expect(createBtn).toBeVisible({ timeout: 15000 })
  await createBtn.click()
  const modal = page.getByRole('dialog', { name: 'Create' })
  await expect(modal).toBeVisible()
  await expect(modal.getByText('POST TO YOUR WORLD')).toBeVisible()
  await expect(modal.getByText('SELL A PIECE')).toBeVisible()
  await expect(modal.getByText('OFFER A SERVICE')).toBeVisible()
  await expect(modal.getByText('CURATE YOUR WORLD')).toBeVisible()
  // a plain member sees NO event door — zero teasers (Leyes 9/11)
  await expect(modal.getByText('HOST AN EVENT')).toHaveCount(0)
  await page.waitForTimeout(900)
  await shot(page, 'v4-04-create-central')
  await modal.getByRole('button', { name: 'Close' }).click()

  // the second member — the one who will follow, message, and buy
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page2 = await ctx2.newPage()
  const b = await signUp(page2, 'QA Buyer')
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); st.b = b
  fs.writeFileSync(STATE_FILE, JSON.stringify(st))
  await ctx2.close()
  await ctx.close()
})

test('C · FOLLOW — B connects to A\'s world (or the honest absence)', async ({ browser, request }) => {
  const { a, b } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const live = await socialLive(request)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await signIn(page, b)
  await page.goto(`/user/${a.uid}`)
  await expect(page.getByText('QA Seller').first()).toBeVisible({ timeout: 20000 })

  if (!live) {
    // pre-0017: the doors simply don't render — absence, not dead buttons
    await expect(page.getByTestId('follow-btn')).toHaveCount(0)
    await expect(page.getByTestId('message-btn')).toHaveCount(0)
    test.info().annotations.push({ type: 'PENDING-MIGRATION', description: 'follows/threads (0017) not applied — social doors honestly absent. Re-run after `supabase db push --linked`.' })
    await shot(page, 'v4-05-social-premigration-absent')
    await ctx.close()
    return
  }

  const followBtn = page.getByTestId('follow-btn')
  await expect(followBtn).toBeVisible({ timeout: 15000 })
  await expect(followBtn).toContainText('FOLLOW')
  await shot(page, 'v4-05-world-with-social')
  await followBtn.click()
  await expect(followBtn).toContainText('CONNECTED', { timeout: 15000 })
  await page.waitForTimeout(600)
  await shot(page, 'v4-06-connected')

  // the edge survives a reload — it's a row, not a state
  await page.reload()
  await expect(page.getByTestId('follow-btn')).toContainText('CONNECTED', { timeout: 20000 })
  await ctx.close()
})

test('D · DM — B messages A; A finds the conversation', async ({ browser, request }) => {
  const { a, b } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const live = await socialLive(request)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()

  if (!live) {
    // pre-0017: Messages says the wires are going in — one honest line
    await signIn(page, b)
    await page.goto('/messages')
    await expect(page.getByText('THE WIRES ARE GOING IN')).toBeVisible({ timeout: 20000 })
    await page.waitForTimeout(600)
    await shot(page, 'v4-07-messages-premigration')
    await ctx.close()
    return
  }

  await signIn(page, b)
  await page.goto(`/user/${a.uid}`)
  await page.getByTestId('message-btn').click()
  await page.waitForURL('**/messages/**', { timeout: 20000 })
  await expect(page.getByText('QA Seller').first()).toBeVisible({ timeout: 15000 })
  await page.getByPlaceholder('Say something…').fill('yo — that world is clean. pulling up friday?')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('pulling up friday?')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(700)
  await shot(page, 'v4-07-dm-sent')

  // A signs in on their own phone and the conversation is waiting
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page2 = await ctx2.newPage()
  await signIn(page2, a)
  await page2.goto('/messages')
  await expect(page2.getByText('QA Buyer').first()).toBeVisible({ timeout: 20000 })
  await expect(page2.getByText('pulling up friday?')).toBeVisible()
  await shot(page2, 'v4-08-inbox-a')
  await page2.getByText('QA Buyer').first().click()
  await page2.waitForURL('**/messages/**', { timeout: 15000 })
  await expect(page2.getByText('pulling up friday?')).toBeVisible({ timeout: 15000 })
  await page2.getByPlaceholder('Say something…').fill('always. bring the USBs 🖤')
  await page2.getByRole('button', { name: 'Send' }).click()
  await expect(page2.getByText('bring the USBs')).toBeVisible({ timeout: 15000 })
  await shot(page2, 'v4-09-thread-reply')
  await ctx2.close()
  await ctx.close()
})

test('E · THE OFFER — a piece with a real price; DM to buy opens a real door', async ({ browser, request }) => {
  const { a, b } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const live = await socialLive(request)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await signIn(page, a)

  // A lists a piece through the +
  await page.getByRole('button', { name: 'Create' }).click()
  const modal = page.getByRole('dialog', { name: 'Create' })
  await modal.getByText('SELL A PIECE').click()
  await expect(modal.getByPlaceholder('C4 archive tee · 001')).toBeVisible()
  const imgFile = path.join(SHOTS, 'v4-01-event-tab.png')
  await modal.locator('input[type=file]').setInputFiles(imgFile)
  await expect(modal.locator('img')).toHaveCount(1, { timeout: 20000 })
  await modal.getByPlaceholder('C4 archive tee · 001').fill('QA archive print · 001')
  await modal.getByPlaceholder('45').fill('45')
  await page.waitForTimeout(500)
  await shot(page, 'v4-10-listing-composer')
  await modal.getByRole('button', { name: /PUT IT ON THE WALL/ }).click()

  if (!live) {
    await expect(modal.getByText(/isn't switched on yet/i)).toBeVisible({ timeout: 20000 })
    test.info().annotations.push({ type: 'PENDING-MIGRATION', description: 'listings (0017) not applied — the composer answered honestly. Re-run after `supabase db push --linked`.' })
    await shot(page, 'v4-11-listing-premigration-honest')
    await ctx.close()
    return
  }

  await expect(modal.getByRole('button', { name: 'SEE YOUR OFFER' })).toBeVisible({ timeout: 60000 })
  await shot(page, 'v4-11-listed')
  await modal.getByRole('button', { name: 'SEE YOUR OFFER' }).click()
  await page.waitForURL('**/profile', { timeout: 15000 })
  await expect(page.getByText('THE OFFER')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('QA archive print · 001')).toBeVisible()
  await expect(page.getByText('$45')).toBeVisible()
  await page.waitForTimeout(700)
  await shot(page, 'v4-12-offer-own-world')

  // B sees the price and the door — and the door opens a conversation
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page2 = await ctx2.newPage()
  await signIn(page2, b)
  await page2.goto(`/user/${a.uid}`)
  await expect(page2.getByText('THE OFFER')).toBeVisible({ timeout: 20000 })
  await expect(page2.getByText('$45')).toBeVisible()
  await shot(page2, 'v4-13-offer-public')
  await page2.getByRole('button', { name: /DM to buy/i }).click()
  await page2.waitForURL('**/messages/**', { timeout: 20000 })
  // the composer arrives seeded with the piece — the click kept its promise
  await expect(page2.getByPlaceholder('Say something…')).toHaveValue(/QA archive print/, { timeout: 15000 })
  await page2.waitForTimeout(500)
  await shot(page2, 'v4-14-dm-to-buy')
  await ctx2.close()
  await ctx.close()
})

test('F · POST regression — the v3 loop stays alive', async ({ browser }) => {
  const { a } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await signIn(page, a)
  await page.getByRole('button', { name: 'Create' }).click()
  const modal = page.getByRole('dialog', { name: 'Create' })
  await modal.getByText('POST TO YOUR WORLD').click()
  await modal.getByPlaceholder(/What is this moment/).fill('v4 walkthrough — the ecosystem breathes')
  await modal.getByRole('button', { name: 'POST IT' }).click()
  // the celebration title carries a <br> (textContent has no space there) —
  // anchor on the single-node paragraph instead
  const posted = modal.getByText('A dated piece in your museum')
  const notYet = modal.getByText(/posting isn't switched on yet/i)
  // first write after a cold spell can take >30s (v3 documented the same
  // cold-start; the second is instant) — the story waits, honestly
  await expect(posted.or(notYet)).toBeVisible({ timeout: 60000 })
  if (await posted.isVisible().catch(() => false)) {
    await modal.getByRole('button', { name: 'SEE IT IN YOUR WORLD' }).click()
    await page.waitForURL('**/profile', { timeout: 15000 })
    await expect(page.getByText('the ecosystem breathes').first()).toBeVisible({ timeout: 20000 })
  }
  await shot(page, 'v4-15-post-loop')
  await ctx.close()
})

test('G · event gates hold; the room stays honest', async ({ browser, request }) => {
  const { b } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))

  // hosting refused server-side — anon and plain member alike
  const anonTry = await request.post(`${SUPABASE_URL}/rest/v1/rpc/admin_save_event`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    data: { p: { title: 'x', slug: 'qa-hostile-v4' } },
  })
  expect(JSON.stringify(await anonTry.json().catch(() => ({})))).toContain('not_member')

  const login = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    data: { email: b.email, password: b.password },
  })
  const session = await login.json()
  expect(session.access_token, 'login for gate test').toBeTruthy()
  const memberTry = await request.post(`${SUPABASE_URL}/rest/v1/rpc/admin_save_event`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    data: { p: { title: 'x', slug: 'qa-hostile-v4' } },
  })
  expect(JSON.stringify(await memberTry.json().catch(() => ({})))).toContain('not_member')

  // the room chat refuses a member with NO ticket (0017 live only)
  if (await socialLive(request)) {
    const evs = await request.get(`${SUPABASE_URL}/rest/v1/events?select=id&status=eq.published&is_test=eq.false&limit=1`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    })
    const [ev] = await evs.json().catch(() => [])
    if (ev?.id) {
      const chatTry = await request.post(`${SUPABASE_URL}/rest/v1/rpc/join_event_chat`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        data: { p_event: ev.id },
      })
      expect(JSON.stringify(await chatTry.json().catch(() => ({})))).toContain('not_in')
    }
  }

  // the public room by slug — honest checkout, honest 404
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('/e/rba-edition-2')
  await expect(page.getByText('GET YOUR TICKET')).toBeVisible({ timeout: 20000 })
  await page.getByText('GET YOUR TICKET').click()
  await page.waitForTimeout(600)
  await shot(page, 'v4-16-event-room-honest')
  await page.goto('/e/this-room-does-not-exist')
  await expect(page.getByText("THIS ROOM ISN'T OPEN")).toBeVisible({ timeout: 15000 })
  await ctx.close()
})

test('H · desktop 1440, anonymous — the ecosystem as an editorial spread', async ({ browser }) => {
  const { a } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'EVENTS' })).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('banner').getByText('THE COLLECTIV4')).toBeVisible()
  await expect(page.getByRole('banner').getByText('Messages')).toBeVisible()
  await page.waitForTimeout(1200)
  await shot(page, 'v4-17-desktop-events')

  await page.goto('/community')
  await expect(page.getByRole('heading', { name: 'COMMUNITY' })).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(1200)
  await shot(page, 'v4-18-desktop-community')

  await page.goto(`/user/${a.uid}`)
  await expect(page.getByText('QA Seller').first()).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(1200)
  await shot(page, 'v4-19-desktop-world')
  await page.mouse.wheel(0, 900)
  await page.waitForTimeout(900)
  await shot(page, 'v4-20-desktop-world-body')

  await page.goto('/e/rba-edition-2')
  await expect(page.getByText('GET YOUR TICKET')).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(1100)
  await shot(page, 'v4-21-desktop-event-room')

  await ctx.close()
})
