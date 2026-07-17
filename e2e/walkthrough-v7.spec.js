import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* =========================================================================
   THE WALKTHROUGH v7 — LA LIMPIEZA. The gate for feat/el-mundo-v7, run
   against the preview in real Chrome + the LIVE remote DB (REST truth).
   v7 quita mentira: the owner-only flows (purge/restore/protect) are proven
   separately by rolled-back SQL evidence (no prod pollution); here we assert
   the anon- and member-facing invariants the browser can see:

   O · every founder RPC (D2 moderation, D4 retention) refuses anon → not_owner;
       retention_activity is deny-all (never public).
   P · auth errors are HUMAN, not codes (D3): a bad sign-in shows a plain-English
       sentence, not the raw "Invalid login credentials" code. (PR #28 moved the
       auth copy ES→English; this assertion tracks that intended product change.)
   Q · sign-up takes first + last name and lands a real session (D3).
   R · visibility tiers (D5): anon clears only 'public'; close-friend curation
       needs a session.
   S · one identity (D1): /artist redirects to the real world when it exists,
       and lands clean-gone when it doesn't — never a static brochure.
   T · retire the v7 QA account.
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v7'
fs.mkdirSync(SHOTS, { recursive: true })

const SUPABASE_URL = 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const ANON_KEY = 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K'
const PATO_ID = 'c255c33b-60d5-4e53-a81a-2f89d7f5ad1b' // a real, verified, non-demo profile
const ZERO = '00000000-0000-0000-0000-000000000000'

test.describe.configure({ mode: 'serial' })

const rest = (request, pathname, opts = {}) => request.fetch(`${SUPABASE_URL}${pathname}`, {
  method: opts.method || 'GET',
  headers: { apikey: ANON_KEY, Authorization: `Bearer ${opts.token || ANON_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  data: opts.data,
})
const rpc = async (request, fn, body = {}, token) => {
  const r = await rest(request, `/rest/v1/rpc/${fn}`, { method: 'POST', data: body, token })
  let j = null
  try { j = await r.json() } catch { j = null }
  return { status: r.status(), body: j }
}

test('O · La Limpieza — founder RPCs refuse anon, retention is deny-all', async ({ request }) => {
  for (const fn of ['admin_list_accounts', 'os_cohort_by_event']) {
    const { body } = await rpc(request, fn, {})
    expect(body?.ok, `${fn} must refuse anon`).toBe(false)
    expect(body?.error).toBe('not_owner')
  }
  expect((await rpc(request, 'admin_soft_purge', { p_user: ZERO })).body?.error).toBe('not_owner')
  expect((await rpc(request, 'admin_restore', { p_user: ZERO })).body?.error).toBe('not_owner')
  expect((await rpc(request, 'admin_set_protected', { p_user: ZERO, p_protected: true })).body?.error).toBe('not_owner')
  // retention_activity: no grant + RLS on → PostgREST denies anon entirely
  const ra = await rest(request, '/rest/v1/retention_activity?select=profile_id&limit=1')
  expect(ra.status(), 'retention_activity must be deny-all to anon').toBeGreaterThanOrEqual(400)
})

test('P · auth errors are human, not codes', async ({ page }) => {
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('Email').fill(`nope-${Date.now()}@example.com`)
  await page.getByPlaceholder('Password').fill('definitely-wrong')
  await page.getByPlaceholder('Password').press('Enter')
  await expect(page.getByText('Wrong email or password.')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/Invalid login credentials/i)).toHaveCount(0)
})

test('Q · sign-up takes first + last name and lands a session', async ({ page }) => {
  const ts = Date.now()
  const email = `c4-qa-v7-${ts}@example.com`
  const password = `QaV7!${ts}`
  await page.goto('/auth')
  await page.getByPlaceholder('First name').fill('Nate')
  await page.getByPlaceholder('Last name').fill(`QA${ts}`)
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Create Account' }).click()
  await page.waitForURL('**/', { timeout: 20000 })
  const uid = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'))
    try { return k ? JSON.parse(localStorage.getItem(k))?.user?.id || null : null } catch { return null }
  })
  expect(uid, 'NO_SESSION_AFTER_SIGNUP — email confirmation may be ON').toBeTruthy()
  fs.appendFileSync(path.join(SHOTS, 'accounts-v7.jsonl'), JSON.stringify({ uid, email, password }) + '\n')
})

test('R · visibility tiers — anon sees public only, close needs a session', async ({ request }) => {
  expect((await rpc(request, 'can_see', { p_owner: PATO_ID, p_tier: 'public' })).body).toBe(true)
  expect((await rpc(request, 'can_see', { p_owner: PATO_ID, p_tier: 'friends' })).body).toBe(false)
  expect((await rpc(request, 'can_see', { p_owner: PATO_ID, p_tier: 'close' })).body).toBe(false)
  // curating a close friend requires an authed session
  expect((await rpc(request, 'add_close_friend', { p_other: PATO_ID })).body?.error).toBe('not_signed_in')
})

test('S · one identity — /artist resolves to the real world or clean-gone, never a brochure', async ({ page }) => {
  // a real, verified handle → redirect into the live world at /user/:id
  await page.goto('/artist/patoduranc')
  await page.waitForURL('**/user/**', { timeout: 15000 })
  expect(page.url()).toContain('/user/')
  // an unknown handle → clean gone, never a static artist page
  await page.goto('/artist/madou')
  await expect(page.getByText("THIS WORLD ISN'T HERE")).toBeVisible({ timeout: 15000 })
})

test('U · the count is public + honest, the wall stays tiered', async ({ request }) => {
  const RBA = '3e1669b2-7302-4061-8eac-55d7c82e7ea1' // has 1 real buyer (friends-default)
  const count = (await rpc(request, 'confirmed_count', { p_event: RBA })).body
  const wall = await (await rest(request, '/rest/v1/rpc/confirmed_attendees', { method: 'POST', data: { p_event: RBA } })).json()
  const names = Array.isArray(wall) ? wall : []
  expect(typeof count, 'count is a public aggregate').toBe('number')
  expect(count, 'a real buyer exists → the count is public and > 0').toBeGreaterThan(0)
  expect(names.length, 'the tiered wall never exceeds the honest count').toBeLessThanOrEqual(count)
  expect(names.length, 'anon is nobody\'s friend → no names leak from a friends-default attendee').toBe(0)
})

test('T · retire the v7 QA account', async ({ page }) => {
  const file = path.join(SHOTS, 'accounts-v7.jsonl')
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
    // retire within the account's OWN RLS row: mark demo so it leaves every real aggregate
    const token = await page.evaluate(() => {
      const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'))
      try { return k ? JSON.parse(localStorage.getItem(k))?.access_token || null : null } catch { return null }
    })
    if (token && acct.uid) {
      await page.request.fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${acct.uid}`, {
        method: 'PATCH',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        data: { is_demo: true, username: null, full_name: 'QA (retired v7)' },
      })
    }
  }
  fs.rmSync(file, { force: true })
})
