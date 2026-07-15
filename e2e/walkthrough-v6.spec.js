import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* =========================================================================
   THE WALKTHROUGH v6 — the gate for feat/el-mundo-v6, run against the
   preview AS A USER, in real Chrome. El descubrimiento:

   A · anon: Community opens EVERYONE (for-you never leaks to anon);
       the FOR YOU door asks for a session, never crashes.
   B · the BRAINSTORM: a new member teaches the universe their taste —
       bank search across domains ("interestelar" finds Interstellar),
       free text is first-class, ONE item toggled public. Persistence
       proven via REST: 3 rows, exactly one is_public.
   C · PRIVACY HOSTILE (the v6 law, live): anon and ANOTHER member read
       the member's tastes → ONLY the public item comes back. A direct
       INSERT is refused — the RPC is the only door.
   D · FOR YOU comes alive: a second member with overlapping (private)
       taste sees the first member ranked; the reasons line names ONLY
       speakable data — never the private overlap.
   E · SERENDIPITY FLOOR: a taste-less member still gets an honest
       surface (real verified worlds rank; or the honest-empty door to
       the brainstorm when the sky is truly empty).
   F · AMIGOS: a request crosses (REST door), the addressee ACCEPTS in
       the CREWS segment; the circle is private (stranger reads zero).
   G · CREW: friends open a room, a message lands, the title branch and
       sender attribution hold for kind=group.
   H · PLAN: fucho sábado — what/where/when, a friend RSVPs IN, the
       roster counts are real, the plan's room opens by its name.
   I · THE LISTENING BAND: a member with crafts but no tastes meets the
       invitation; it opens the builder on the taste step.
   J · DESKTOP 1440: for-you + plans hold the wide composition.
   K · the QA accounts retire; tastes/crafts emptied through their own
       doors; Community closes clean; anon reads ZERO taste rows.

   Wave-2 stories (appended when D4 lands): L · world modules per craft,
   M · the AMIGO button on a world, N · TASTE/SETS movements public side.

   Self-contained: makes its own accounts, appends them to accounts.jsonl,
   writes state-v6.json. Founder-only stories stay manual (Pato's pass).
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v6'
const STATE_FILE = path.join(SHOTS, 'state-v6.json')
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

const rest = (request, pathname, opts = {}) => request.fetch(`${SUPABASE_URL}${pathname}`, {
  method: opts.method || 'GET',
  headers: {
    apikey: ANON_KEY,
    Authorization: `Bearer ${opts.token || ANON_KEY}`,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  },
  data: opts.data,
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

/* add a bank taste: focus a domain rail, search, tap the option */
async function pickTaste(scope, domain, query, slug) {
  await scope.getByTestId(`taste-domain-${domain}`).click()
  const search = scope.getByTestId('taste-search')
  await search.fill('')
  await search.fill(query)
  const opt = scope.getByTestId(`taste-opt-${slug}`).first()
  await expect(opt).toBeVisible({ timeout: 15000 })
  await opt.click()
}

/* drive the builder from its opening question to the taste step */
async function builderToTaste(page, sheet, craftQuery, craftSlug) {
  await expect(sheet).toBeVisible({ timeout: 20000 })
  await expect(sheet.getByText('WHAT DO YOU MAKE?')).toBeVisible({ timeout: 15000 })
  await pickCraft(sheet, craftQuery, craftSlug)
  await sheet.getByRole('button', { name: /Next/ }).click()
  await expect(sheet.getByText('WHAT SHOULD THEY FEEL?')).toBeVisible({ timeout: 20000 })
  await sheet.getByRole('button', { name: /skip this one/ }).click()
  await expect(sheet.getByText('READY TO SHOW TODAY?')).toBeVisible()
  await sheet.getByRole('button', { name: 'COMPOSE MY WORLD' }).click()
  await sheet.getByRole('button', { name: 'START BUILDING →' }).click()
  // composed plans open on the 'line' step; taste is the next room
  for (let i = 0; i < 3; i++) {
    if (await sheet.getByTestId('taste-search').isVisible().catch(() => false)) break
    await sheet.getByRole('button', { name: /skip this step/ }).click()
  }
  await expect(sheet.getByTestId('taste-search')).toBeVisible({ timeout: 15000 })
}

test('A · anon — Community opens EVERYONE; for-you never leaks', async ({ page }) => {
  await page.goto('/community')
  await expect(page.getByRole('heading', { name: 'COMMUNITY' })).toBeVisible({ timeout: 20000 })
  // anon rests on the everyone view — no feed, no crash
  await expect(page.getByTestId('foryou-feed')).toHaveCount(0)
  await page.waitForTimeout(700)
  await shot(page, 'v6-01-anon-everyone')
  // the FOR YOU door asks for a session instead of pretending
  await page.getByTestId('foryou-toggle').click()
  await page.waitForTimeout(800)
  await expect(page.getByTestId('foryou-feed')).toHaveCount(0)
  await shot(page, 'v6-02-anon-foryou-door')
})

test('B · the brainstorm — the universe learns a taste, quietly', async ({ browser, request }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const b = await signUp(page, 'QA Nova')
  fs.writeFileSync(STATE_FILE, JSON.stringify({ b }))

  await page.goto('/profile')
  const sheet = page.getByRole('dialog', { name: 'Build your world' })
  await builderToTaste(page, sheet, 'dj', 'dj')
  await page.waitForTimeout(500)
  await shot(page, 'v6-03-taste-step')

  // the bank recognizes across languages: "interestelar" → Interstellar
  await pickTaste(sheet, 'music', 'house', 'music-house')
  await pickTaste(sheet, 'film', 'interestelar', 'film-interstellar')
  // free text is first-class — the bank never limits the constellation
  await sheet.getByTestId('taste-domain-interest').click()
  const search = sheet.getByTestId('taste-search')
  await search.fill('')
  await search.fill('fucho sábados')
  await search.press('Enter')
  await expect(sheet.getByText('fucho sábados')).toBeVisible({ timeout: 10000 })
  // one decision of visibility: house steps into the light
  await sheet.getByTestId('taste-vis-music-house').click()
  await page.waitForTimeout(400)
  await shot(page, 'v6-04-taste-constellation')
  await sheet.getByRole('button', { name: /Next/ }).click()
  await page.waitForTimeout(1500)

  // server truth: 3 rows, exactly ONE public — with the OWNER's eyes
  const token = await tokenOf(page)
  const mine = await rest(request, `/rest/v1/profile_tastes?profile_id=eq.${b.uid}&select=domain,label,is_public`, { token }).then(r => r.json())
  expect(mine.length).toBe(3)
  expect(mine.filter(r => r.is_public).map(r => r.label)).toEqual(['House'])
  await ctx.close()
})

test('C · privacy hostile — the quiet layer holds on the live surface', async ({ browser, request }) => {
  const { b } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))

  // anon: only the public item exists
  const anonRows = await rest(request, `/rest/v1/profile_tastes?profile_id=eq.${b.uid}&select=label,is_public`).then(r => r.json())
  expect(anonRows.length).toBe(1)
  expect(anonRows[0].label).toBe('House')

  // another authenticated member: same single row, nothing raw
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const c = await signUp(page, 'QA Vega')
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); st.c = c
  fs.writeFileSync(STATE_FILE, JSON.stringify(st))
  const cTok = await tokenOf(page)
  const otherRows = await rest(request, `/rest/v1/profile_tastes?profile_id=eq.${b.uid}&select=label`, { token: cTok }).then(r => r.json())
  expect(otherRows.length).toBe(1)
  expect(otherRows[0].label).toBe('House')

  // the only door is the RPC: a direct INSERT is refused outright
  const forged = await rest(request, '/rest/v1/profile_tastes', {
    token: cTok, method: 'POST',
    data: { profile_id: b.uid, domain: 'music', label: 'forged', is_public: true },
  })
  expect([401, 403]).toContain(forged.status())
  await ctx.close()
})

test('D · for-you comes alive — raw ranks, only the public speaks', async ({ browser }) => {
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await signIn(page, st.c)

  // Vega brainstorms an overlap — ALL private on her side
  await page.goto('/profile')
  const sheet = page.getByRole('dialog', { name: 'Build your world' })
  await builderToTaste(page, sheet, 'photo', 'photographer')
  await pickTaste(sheet, 'music', 'house', 'music-house')
  await pickTaste(sheet, 'film', 'interstellar', 'film-interstellar')
  await sheet.getByRole('button', { name: /Next/ }).click()
  await page.waitForTimeout(1500)
  await sheet.getByRole('button', { name: 'Close' }).click()

  // FOR YOU opens as the signed-in default — Nova ranks by the quiet overlap
  await page.goto('/community')
  await expect(page.getByTestId('foryou-feed')).toBeVisible({ timeout: 20000 })
  const novaCard = page.getByTestId(`foryou-person-${st.b.uid}`)
  await expect(novaCard).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(700)
  await shot(page, 'v6-05-foryou-feed')

  // the reasons line: speakable truth only. Interstellar stays private
  // on BOTH sides — the card may say "shares house" (Nova made it public),
  // never the film.
  const reasons = await novaCard.getByTestId('foryou-reasons').innerText()
  expect(reasons.toLowerCase()).not.toContain('interstellar')
  expect(reasons.toLowerCase()).not.toContain('interestelar')
  expect(reasons.length).toBeGreaterThan(0)
  await novaCard.click()
  await expect(page).toHaveURL(new RegExp(`/user/${st.b.uid}$`), { timeout: 15000 })
  await page.waitForTimeout(700)
  await shot(page, 'v6-06-foryou-to-world')
  await ctx.close()
})

test('E · serendipity floor — a taste-less member still gets truth', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const e = await signUp(page, 'QA Blank')
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); st.e = e
  fs.writeFileSync(STATE_FILE, JSON.stringify(st))
  // close the newborn builder — this person carries nothing yet
  await page.goto('/profile')
  const sheet = page.getByRole('dialog', { name: 'Build your world' })
  await expect(sheet).toBeVisible({ timeout: 20000 })
  await sheet.getByRole('button', { name: 'Close' }).click()

  await page.goto('/community')
  await page.waitForTimeout(2500)
  const hasFeed = await page.getByTestId('foryou-feed').isVisible().catch(() => false)
  const hasEmpty = await page.getByTestId('foryou-empty').isVisible().catch(() => false)
  // dual-mode honesty: real worlds rank (verified members carry weight),
  // or the sky is empty and the door to the brainstorm opens. Never fake.
  expect(hasFeed || hasEmpty).toBeTruthy()
  await shot(page, 'v6-07-serendipity-floor')
  if (hasEmpty) {
    await page.getByText('brainstorm your taste →').click()
    await expect(page).toHaveURL(/\/profile$/, { timeout: 15000 })
  }
  await ctx.close()
})

test('F · amigos — the bond is mutual and PRIVATE', async ({ browser, request }) => {
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))

  // Vega reaches for Nova (the profile button is wave-2 UI; the door
  // itself is live — server truth first)
  const ctxC = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pageC = await ctxC.newPage()
  await signIn(pageC, st.c)
  const cTok = await tokenOf(pageC)
  const req = await rest(request, '/rest/v1/rpc/request_friend', {
    token: cTok, method: 'POST', data: { p_other: st.b.uid },
  }).then(r => r.json())
  expect(req.ok).toBeTruthy()
  expect(req.status).toBe('pending')

  // Nova finds the request waiting in CREWS and accepts with one press
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pageB = await ctxB.newPage()
  await signIn(pageB, st.b)
  await pageB.goto('/messages?seg=crews')
  const accept = pageB.getByTestId(`circle-accept-${st.c.uid}`)
  await expect(accept).toBeVisible({ timeout: 20000 })
  await pageB.waitForTimeout(500)
  await shot(pageB, 'v6-08-circle-request')
  await accept.click()
  await expect(pageB.getByTestId('circle-count')).toContainText('1', { timeout: 15000 })
  await shot(pageB, 'v6-09-circle-accepted')

  // the bond is nobody's directory: a stranger reads ZERO rows
  const ctxE = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pageE = await ctxE.newPage()
  await signIn(pageE, st.e)
  const eTok = await tokenOf(pageE)
  const spied = await rest(request, `/rest/v1/friendships?or=(requester_id.eq.${st.b.uid},addressee_id.eq.${st.b.uid})`, { token: eTok }).then(r => r.json())
  expect(spied.length).toBe(0)
  await ctxB.close(); await ctxC.close(); await ctxE.close()
})

test('G · crew — friends open a room and it speaks', async ({ browser }) => {
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pageB = await ctxB.newPage()
  await signIn(pageB, st.b)
  await pageB.goto('/messages?seg=crews')
  await pageB.getByTestId('crew-create').click()
  await pageB.getByTestId('crew-title-input').fill('la crew qa')
  await pageB.getByTestId(`crew-friend-${st.c.uid}`).click()
  await pageB.getByRole('button', { name: /open the room/i }).click()
  await pageB.waitForURL('**/messages/**', { timeout: 20000 })
  const threadUrl = pageB.url()
  const composer = pageB.getByPlaceholder(/message/i).or(pageB.locator('textarea, input[type="text"]').last())
  await composer.fill('primera señal de la crew')
  await composer.press('Enter')
  await expect(pageB.getByText('primera señal de la crew')).toBeVisible({ timeout: 15000 })
  await pageB.waitForTimeout(500)
  await shot(pageB, 'v6-10-crew-room')

  // Vega walks in — title branch + sender attribution hold for kind=group
  const ctxC = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pageC = await ctxC.newPage()
  await signIn(pageC, st.c)
  await pageC.goto(new URL(threadUrl).pathname)
  await expect(pageC.getByText('la crew qa').first()).toBeVisible({ timeout: 20000 })
  await expect(pageC.getByText('primera señal de la crew')).toBeVisible({ timeout: 15000 })
  await expect(pageC.getByText('QA Nova').first()).toBeVisible({ timeout: 15000 })
  await shot(pageC, 'v6-11-crew-other-side')
  const stNew = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  stNew.crewPath = new URL(threadUrl).pathname
  fs.writeFileSync(STATE_FILE, JSON.stringify(stNew))
  await ctxB.close(); await ctxC.close()
})

test('H · the plan — fucho sábado, real RSVPs, a room with a name', async ({ browser, request }) => {
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pageB = await ctxB.newPage()
  await signIn(pageB, st.b)
  await pageB.goto('/messages?seg=plans')
  await pageB.getByTestId('plan-create').click()
  await pageB.getByTestId('plan-title-input').fill('fucho sábado')
  await pageB.locator('#plan-spot').fill('memorial park')
  await pageB.getByTestId(`plan-friend-${st.c.uid}`).click()
  await pageB.getByRole('button', { name: /make it real/i }).click()
  const card = pageB.locator('[data-testid^="plan-card-"]').filter({ hasText: 'fucho sábado' }).first()
  await expect(card).toBeVisible({ timeout: 20000 })
  await pageB.waitForTimeout(600)
  await shot(pageB, 'v6-12-plan-born')

  // Vega is invited: RSVP IN — the count is real people, not vanity
  const ctxC = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pageC = await ctxC.newPage()
  await signIn(pageC, st.c)
  await pageC.goto('/messages?seg=plans')
  const cardC = pageC.locator('[data-testid^="plan-card-"]').filter({ hasText: 'fucho sábado' }).first()
  await expect(cardC).toBeVisible({ timeout: 20000 })
  await cardC.getByTestId('plan-rsvp-in').click()
  await pageC.waitForTimeout(1000)
  await expect(cardC).toContainText(/2 in/i, { timeout: 15000 })
  await shot(pageC, 'v6-13-plan-rsvp')

  // server truth: her status is a row
  const cTok = await tokenOf(pageC)
  const plans = await rest(request, '/rest/v1/rpc/my_plans', { token: cTok, method: 'POST', data: {} }).then(r => r.json())
  const plan = (plans.plans || []).find(p => p.title === 'fucho sábado')
  expect(plan?.my_status).toBe('in')
  expect(plan?.in_count).toBe(2)

  // the plan's room carries its name
  await cardC.getByTestId('plan-room-door').click()
  await pageC.waitForURL('**/messages/**', { timeout: 20000 })
  await expect(pageC.getByText('fucho sábado').first()).toBeVisible({ timeout: 15000 })
  await shot(pageC, 'v6-14-plan-room')
  const stNew = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  stNew.planId = plan?.id
  fs.writeFileSync(STATE_FILE, JSON.stringify(stNew))
  await ctxB.close(); await ctxC.close()
})

test('I · the listening band — crafts without taste meet the invitation', async ({ browser }) => {
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await signIn(page, st.e)

  // Blank picks a craft but walks past the brainstorm
  await page.goto('/profile')
  const sheet = page.getByRole('dialog', { name: 'Build your world' })
  await builderToTaste(page, sheet, 'painter', 'painter')
  await sheet.getByRole('button', { name: /skip this step/ }).click()
  await page.waitForTimeout(800)
  await sheet.getByRole('button', { name: 'Close' }).click()

  await page.reload()
  const band = page.getByTestId('taste-invite')
  await expect(band).toBeVisible({ timeout: 20000 })
  await expect(band).toContainText('THE UNIVERSE LISTENS')
  await page.waitForTimeout(500)
  await shot(page, 'v6-15-listening-band')
  await band.click()
  await expect(page.getByTestId('taste-search')).toBeVisible({ timeout: 20000 })
  await ctx.close()
})

test('J · desktop 1440 — the wide composition holds', async ({ browser }) => {
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await signIn(page, st.c)
  await page.goto('/community')
  await expect(page.getByTestId('foryou-feed')).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(1200)
  await shot(page, 'v6-16-desktop-foryou')
  await page.goto('/messages?seg=plans')
  await expect(page.locator('[data-testid^="plan-card-"]').first()).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(800)
  await shot(page, 'v6-17-desktop-plans')
  await ctx.close()
})

test('K · the QA accounts retire; the universe closes clean', async ({ browser, request }) => {
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const accounts = fs.readFileSync(path.join(SHOTS, 'accounts.jsonl'), 'utf8')
    .trim().split('\n').map(l => JSON.parse(l))

  // the plan retires with its maker
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pageB = await ctxB.newPage()
  await signIn(pageB, st.b)
  const bTok = await tokenOf(pageB)
  if (st.planId) {
    await rest(request, '/rest/v1/rpc/cancel_plan', { token: bTok, method: 'POST', data: { p_plan: st.planId } })
  }
  await ctxB.close()

  for (const acct of accounts) {
    const resp = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      data: { email: acct.email, password: acct.password },
    }).then(r => r.json())
    const token = resp.access_token
    if (!token) continue
    // empty the layers through their own doors, then retire the persona
    await rest(request, '/rest/v1/rpc/set_profile_tastes', { token, method: 'POST', data: { p: [] } })
    await rest(request, '/rest/v1/rpc/set_profile_crafts', { token, method: 'POST', data: { p_craft_ids: [], p_primary_id: null } })
    await rest(request, `/rest/v1/rpc/remove_friend`, { token, method: 'POST', data: { p_other: st.b.uid } })
    await rest(request, `/rest/v1/profiles?id=eq.${acct.uid}`, {
      token, method: 'PATCH', headers: { Prefer: 'return=minimal' },
      data: { is_demo: true, username: null, full_name: 'QA (retired)' },
    })
  }

  // zero leakage: anon reads no tastes, no crafts, no faces
  for (const acct of accounts) {
    const tastes = await rest(request, `/rest/v1/profile_tastes?profile_id=eq.${acct.uid}&select=id`).then(r => r.json())
    expect(tastes.length).toBe(0)
    const crafts = await rest(request, `/rest/v1/profile_crafts?profile_id=eq.${acct.uid}&select=craft_id`).then(r => r.json())
    expect(crafts.length).toBe(0)
    const prof = await rest(request, `/rest/v1/profiles?id=eq.${acct.uid}&select=id`).then(r => r.json())
    expect(prof.length).toBe(0)
  }

  // Community closes clean to a stranger's eyes
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('/community')
  await expect(page.getByRole('heading', { name: 'COMMUNITY' })).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(1500)
  await expect(page.getByText('QA Nova')).toHaveCount(0)
  await expect(page.getByText('QA Vega')).toHaveCount(0)
  await expect(page.getByText('QA Blank')).toHaveCount(0)
  await shot(page, 'v6-18-community-clean')
  await ctx.close()
})
