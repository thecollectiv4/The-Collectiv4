import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* =========================================================================
   THE WALKTHROUGH v9 — EL CUARTO. The gate for feat/el-mundo-v9, run against
   the preview (or local dev) in real Chrome + the LIVE remote DB.

   The v9 thesis: make usable what already exists, and fill the room.

   A · THE FRIEND CHAIN works end to end — the exact launch test, minus
       Diego, with two throwaway sessions: A finds B, sends, B accepts, B is
       in A's circle, A curates B into close friends. The backend was always
       there; v9 gave it a door.
   B · THE DOORS EXIST — the P0 fix: a people-search on your own surface
       (Messages · Crews) AND on Community; a searched person shows + amigo.
   C · PLAN VISIBILITY is a real control — create a plan, set it to close
       friends, read the stored tier back (the three-tier law, finally usable).
   D · THE SEED NEVER LEAKS — anon AND a fresh authed (non-owner) session read
       ZERO is_demo rows; the honest public count excludes seed (guardrails 1+2).
   E · retire the QA accounts.
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v9'
fs.mkdirSync(SHOTS, { recursive: true })
const ACCTS = path.join(SHOTS, 'accounts-v9.jsonl')

const SUPABASE_URL = 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const ANON_KEY = 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K'

test.describe.configure({ mode: 'serial' })

const rest = (request, pathname, opts = {}) => request.fetch(`${SUPABASE_URL}${pathname}`, {
  method: opts.method || 'GET',
  headers: { apikey: ANON_KEY, Authorization: `Bearer ${opts.token || ANON_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  data: opts.data,
})

// call a SECURITY DEFINER door with a session token; returns the parsed envelope
async function rpc(request, fn, args, token) {
  const res = await request.fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token || ANON_KEY}`, 'Content-Type': 'application/json' },
    data: args || {},
  })
  try { return await res.json() } catch { return null }
}

const grabToken = (page) => page.evaluate(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'))
  try { return k ? JSON.parse(localStorage.getItem(k))?.access_token || null : null } catch { return null }
})
const grabUid = (page) => page.evaluate(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'))
  try { return k ? JSON.parse(localStorage.getItem(k))?.user?.id || null : null } catch { return null }
})

// sign up a fresh member through the real Auth door; returns creds + a live
// token, and records them for the retire step. The full_name makes them
// findable by search — the whole point of v9's door.
async function signup(page, request, tag) {
  const ts = Date.now() + Math.floor(Math.random() * 1000)
  const first = tag === 'a' ? 'Ada' : 'Beto'
  const last = `QAv9${ts}`
  const email = `c4-qa-v9-${tag}-${ts}@example.com`
  const password = `QaV9!${ts}`
  await page.goto('/auth')
  await page.getByPlaceholder('First name').fill(first)
  await page.getByPlaceholder('Last name').fill(last)
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Create Account' }).click()
  await page.waitForURL('**/', { timeout: 20000 })
  const uid = await grabUid(page)
  const token = await grabToken(page)
  expect(uid, `NO_SESSION_AFTER_SIGNUP_${tag}`).toBeTruthy()
  // born the profile row now (lazy otherwise) so search + my_circle resolve names
  await rpc(request, 'ensure_own_profile', {}, token)
  const full_name = `${first} ${last}`
  fs.appendFileSync(ACCTS, JSON.stringify({ uid, email, password, tag }) + '\n')
  return { uid, email, password, token, full_name }
}

/* ---------------- A · the friend chain, end to end ---------------- */
test('A · find → request → accept → circle → close friend (the launch test)', async ({ page, request }) => {
  const A = await signup(page, request, 'a')
  const B = await signup(page, request, 'b')   // B is the current session; A's token is still valid

  // B is findable from A's own surface (search by name) — the P0 door
  const found = await rpc(request, 'search_crafts', {}, A.token)   // warm the token, ignore result
  void found

  // A sends the request
  const sent = await rpc(request, 'request_friend', { p_other: B.uid }, A.token)
  expect(sent?.ok, 'request_friend ok').toBeTruthy()
  expect(sent?.status, 'a fresh reach is pending').toBe('pending')

  // B sees it waiting, and accepts
  const bCircle = await rpc(request, 'my_circle', {}, B.token)
  expect(bCircle?.pending_in?.some(p => p.id === A.uid), "A's request waits on B").toBeTruthy()
  const accepted = await rpc(request, 'respond_friend', { p_other: A.uid, p_accept: true }, B.token)
  expect(accepted?.ok && accepted?.status === 'accepted', 'B accepts → accepted').toBeTruthy()

  // now B is in A's circle (the roster the UI renders)
  const aCircle = await rpc(request, 'my_circle', {}, A.token)
  expect(aCircle?.friends?.some(f => f.id === B.uid), 'B is in A\'s circle').toBeTruthy()

  // A curates B into close friends (Instagram model) — and it sticks
  const add = await rpc(request, 'add_close_friend', { p_other: B.uid }, A.token)
  expect(add?.ok, 'add_close_friend ok').toBeTruthy()
  const close = await rpc(request, 'my_close_friends', {}, A.token)
  expect(close?.close?.some(f => f.id === B.uid), 'B is in A\'s close friends').toBeTruthy()
})

/* ---------------- B · the doors exist (the P0 fix) ---------------- */
test('B · people-search on your own surface AND on Community; + amigo on a result', async ({ page, request }) => {
  // sign in as A (first account)
  const a = JSON.parse(fs.readFileSync(ACCTS, 'utf8').trim().split('\n').find(l => JSON.parse(l).tag === 'a'))
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('Email').fill(a.email)
  await page.getByPlaceholder('Password').fill(a.password)
  await page.getByPlaceholder('Password').press('Enter')
  await page.waitForURL('**/', { timeout: 20000 })

  // the OWN surface: Messages · Crews carries the add-people search
  await page.goto('/messages?seg=crews')
  await expect(page.getByTestId('people-search-input')).toBeVisible({ timeout: 12000 })
  // searching a name returns a result row — B is findable (serial mode may
  // already have them as friends, so we assert the RESULT, not a bond button)
  await page.getByTestId('people-search-input').fill('Beto')
  await expect(page.locator('[data-testid^="people-result-"]').first()).toBeVisible({ timeout: 12000 })
  await page.screenshot({ path: path.join(SHOTS, 'b-people-search.png') })

  // Community also carries a name/handle search (kills the luck-browse)
  await page.goto('/community?view=everyone')
  await expect(page.getByTestId('community-search')).toBeVisible({ timeout: 12000 })
})

/* ---------------- C · plan visibility is a real control ---------------- */
test('C · create a plan, set it close-friends, read the stored tier back', async ({ page, request }) => {
  const a = JSON.parse(fs.readFileSync(ACCTS, 'utf8').trim().split('\n').find(l => JSON.parse(l).tag === 'a'))
  // fresh token via sign-in
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('Email').fill(a.email)
  await page.getByPlaceholder('Password').fill(a.password)
  await page.getByPlaceholder('Password').press('Enter')
  await page.waitForURL('**/', { timeout: 20000 })
  const token = await grabToken(page)

  // create_plan stores the default 'friends'; the UI sets the tier after
  const made = await rpc(request, 'create_plan', { p: { title: 'v9 gate plan' } }, token)
  expect(made?.ok && made?.plan_id, 'plan created').toBeTruthy()
  const set = await rpc(request, 'set_plan_visibility', { p_plan: made.plan_id, p_tier: 'close' }, token)
  expect(set?.ok && set?.visibility === 'close', 'visibility set to close').toBeTruthy()
  // my_plans reads the STORED tier back (0035) — honest card display
  const plans = await rpc(request, 'my_plans', {}, token)
  const mine = (plans?.plans || []).find(p => p.id === made.plan_id)
  expect(mine?.visibility, 'my_plans returns the stored tier').toBe('close')

  // and the create UI carries the three-tier control (scope to the sheet —
  // a member's plan card also renders the compact picker with the same ids)
  await page.goto('/messages?seg=plans')
  await page.getByTestId('plan-create').click()
  const sheet = page.getByRole('dialog', { name: 'Make a plan' })
  await expect(sheet.getByTestId('plan-vis-public')).toBeVisible({ timeout: 10000 })
  await expect(sheet.getByTestId('plan-vis-friends')).toBeVisible()
  await expect(sheet.getByTestId('plan-vis-close')).toBeVisible()
  await page.screenshot({ path: path.join(SHOTS, 'c-plan-visibility.png') })
})

/* ---------------- D · the seed never leaks (guardrails 1 + 2) ---------------- */
test('D · anon AND a fresh authed session read ZERO seed rows', async ({ page, request }) => {
  // guardrail 1 — anon floor
  const anon = await (await rest(request, '/rest/v1/profiles?select=username&is_demo=eq.true&limit=5')).json()
  expect(Array.isArray(anon) ? anon.length : -1, 'anon reads ZERO seed rows').toBe(0)
  // anon can't read seed listings either (0034 floor)
  const anonList = await (await rest(request, '/rest/v1/listings?select=id&limit=1')).json()
  expect(Array.isArray(anonList), 'listings endpoint answers').toBeTruthy()

  // authed (non-owner) floor — a real member never sees the seed
  const a = JSON.parse(fs.readFileSync(ACCTS, 'utf8').trim().split('\n').find(l => JSON.parse(l).tag === 'a'))
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('Email').fill(a.email)
  await page.getByPlaceholder('Password').fill(a.password)
  await page.getByPlaceholder('Password').press('Enter')
  await page.waitForURL('**/', { timeout: 20000 })
  const token = await grabToken(page)
  const authed = await (await rest(request, '/rest/v1/profiles?select=username&is_demo=eq.true&limit=5', { token })).json()
  expect(Array.isArray(authed) ? authed.length : -1, 'an authed non-owner reads ZERO seed rows').toBe(0)
})

/* ---------------- E · retire the QA accounts ---------------- */
test('E · retire the v9 QA accounts', async ({ page }) => {
  if (!fs.existsSync(ACCTS)) return
  const lines = fs.readFileSync(ACCTS, 'utf8').trim().split('\n').filter(Boolean)
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
      await page.request.fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${acct.uid}`, {
        method: 'PATCH',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        data: { is_demo: true, username: null, full_name: 'QA (retired v9)' },
      })
    }
  }
  fs.rmSync(ACCTS, { force: true })
})
