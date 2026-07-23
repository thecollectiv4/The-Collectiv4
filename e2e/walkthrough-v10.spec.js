import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* =========================================================================
   THE WALKTHROUGH v10 — EL ESPECTRO + LAS CAMPANAS. The gate for
   feat/el-mundo-v10, run against the preview (or local dev) in real
   Chrome + the LIVE remote DB.

   The v10 thesis: the seed became a design instrument (60 worlds across
   the human range), and retention stopped being structurally impossible
   (the bells: one event stream → inbox → badge → mark read).

   A · THE BELLS RING, end to end — two throwaway sessions: A requests B
       → B hears friend_request; B accepts → A hears friend_accept; B
       plan-invites A → A hears plan_invite; A answers 'in' → B hears
       plan_rsvp; A messages the room twice → B holds ONE coalesced
       message bell carrying the newest preview; mark read → zero.
   B · THE BELL HAS A FACE — the badge on the Messages mark and the
       inbox block render for a member with unread signals; mark-all
       clears both.
   C · THE FOR-YOU PAYLOAD IS HONEST — a non-owner's people rows all
       carry is_demo: false (0040's field lands, nobody's feed changed).
   D · THE SEED NEVER LEAKS, v10 batch included — anon AND a fresh authed
       non-owner read ZERO is_demo rows and ZERO v10 usernames; anon
       bells return not_authenticated.
   E · retire the QA accounts.
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v10'
fs.mkdirSync(SHOTS, { recursive: true })
const ACCTS = path.join(SHOTS, 'accounts-v10.jsonl')

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
// token, and records them for the retire step.
async function signup(page, request, tag) {
  const ts = Date.now() + Math.floor(Math.random() * 1000)
  const first = tag === 'a' ? 'Ada' : 'Beto'
  const last = `QAv10${ts}`
  const email = `c4-qa-v10-${tag}-${ts}@example.com`
  const password = `QaV10!${ts}`
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
  await rpc(request, 'ensure_own_profile', {}, token)
  const full_name = `${first} ${last}`
  fs.appendFileSync(ACCTS, JSON.stringify({ uid, email, password, tag }) + '\n')
  return { uid, email, password, token, full_name }
}

async function signin(page, email, password) {
  await page.goto('/auth')
  // the first 'Sign In' is the MODE toggle; submission rides Enter (v9 pattern)
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByPlaceholder('Password').press('Enter')
  await page.waitForURL('**/', { timeout: 20000 })
}

let A = null
let B = null
let PLAN = null

/* ---------------- A · the bells ring, end to end ---------------- */
test('A · las campanas — every wire rings and the message bell coalesces', async ({ page, request }) => {
  test.setTimeout(180000)
  A = await signup(page, request, 'a')
  await page.evaluate(() => localStorage.clear())
  B = await signup(page, request, 'b')

  // A asks B — B hears it
  const req = await rpc(request, 'request_friend', { p_other: B.uid }, A.token)
  expect(req?.ok, 'REQUEST_FRIEND_FAILED').toBeTruthy()
  let count = await rpc(request, 'signals_unread_count', {}, B.token)
  expect(count?.ok).toBeTruthy()
  expect(count.count, 'B_SHOULD_HEAR_ONE_BELL').toBe(1)
  let inbox = await rpc(request, 'my_signals', {}, B.token)
  expect(inbox?.ok).toBeTruthy()
  expect(inbox.signals[0].kind).toBe('friend_request')
  expect(inbox.signals[0].actor?.id).toBe(A.uid)

  // B accepts — A hears it
  const acc = await rpc(request, 'respond_friend', { p_other: A.uid, p_accept: true }, B.token)
  expect(acc?.status).toBe('accepted')
  let aInbox = await rpc(request, 'my_signals', {}, A.token)
  expect(aInbox?.ok).toBeTruthy()
  expect(aInbox.signals.map(s => s.kind), 'A_HEARS_ACCEPT').toContain('friend_accept')

  // guardrail 4 payload law (0044): is_demo travels with the identity —
  // the circle payload carries the flag on every person it transports
  const circle = await rpc(request, 'my_circle', {}, B.token)
  const friendRow = (circle?.friends || []).find(f => f.id === A.uid)
  expect(friendRow, 'A_IN_B_CIRCLE').toBeTruthy()
  expect(friendRow.is_demo, 'CIRCLE_PAYLOAD_CARRIES_IS_DEMO').toBe(false)

  // B makes a plan with A invited — A hears the invite, with the title
  const plan = await rpc(request, 'create_plan', { p: { title: 'fucho v10 gate', spot: 'Mason Park', invitee_ids: [A.uid] } }, B.token)
  expect(plan?.ok, 'CREATE_PLAN_FAILED').toBeTruthy()
  PLAN = plan
  aInbox = await rpc(request, 'my_signals', {}, A.token)
  const invite = aInbox.signals.find(s => s.kind === 'plan_invite')
  expect(invite, 'A_HEARS_PLAN_INVITE').toBeTruthy()
  expect(invite.subject?.title).toBe('fucho v10 gate')

  // A answers IN — B (the creator) hears the RSVP
  const rsvp = await rpc(request, 'rsvp_plan', { p_plan: plan.plan_id, p_status: 'in' }, A.token)
  expect(rsvp?.status).toBe('in')

  // guardrail 4 payload law (0044): my_plans transports is_demo on the
  // creator and on every roster row
  const myPlans = await rpc(request, 'my_plans', {}, A.token)
  const pl = (myPlans?.plans || []).find((x) => x.id === plan.plan_id)
  expect(pl, 'A_SEES_THE_PLAN').toBeTruthy()
  expect('is_demo' in (pl.creator || {}), 'PLAN_CREATOR_CARRIES_IS_DEMO').toBeTruthy()
  expect((pl.roster || []).length > 0 && pl.roster.every((r) => 'is_demo' in r), 'ROSTER_CARRIES_IS_DEMO').toBeTruthy()
  inbox = await rpc(request, 'my_signals', {}, B.token)
  const heard = inbox.signals.find(s => s.kind === 'plan_rsvp')
  expect(heard, 'B_HEARS_RSVP').toBeTruthy()
  expect(heard.subject?.status).toBe('in')

  // A speaks twice in the plan's room — B holds ONE coalesced message bell
  for (const body of ['primer mensaje', 'segundo mensaje — el que debe verse']) {
    const res = await rest(request, '/rest/v1/thread_messages', {
      method: 'POST', token: A.token,
      data: { thread_id: plan.thread_id, sender_id: A.uid, body },
    })
    expect(res.status(), 'MESSAGE_INSERT_FAILED').toBe(201)
  }
  inbox = await rpc(request, 'my_signals', {}, B.token)
  const msgBells = inbox.signals.filter(s => s.kind === 'message' && !s.read_at)
  expect(msgBells.length, 'MESSAGE_BELL_MUST_COALESCE').toBe(1)
  expect(msgBells[0].subject?.preview).toContain('segundo mensaje')

  // B marks everything read — silence, honestly
  const marked = await rpc(request, 'mark_signals_read', {}, B.token)
  expect(marked?.ok).toBeTruthy()
  count = await rpc(request, 'signals_unread_count', {}, B.token)
  expect(count.count, 'READ_MEANS_ZERO').toBe(0)

  // reading the room IS reading the bell (0043): A rings once more, B
  // "opens the thread" — the thread-scoped door clears it
  const res2 = await rest(request, '/rest/v1/thread_messages', {
    method: 'POST', token: A.token,
    data: { thread_id: plan.thread_id, sender_id: A.uid, body: 'tercero — para el puente' },
  })
  expect(res2.status()).toBe(201)
  count = await rpc(request, 'signals_unread_count', {}, B.token)
  expect(count.count, 'NEW_MESSAGE_RINGS_AGAIN').toBe(1)
  const bridged = await rpc(request, 'mark_thread_signals_read', { p_thread: plan.thread_id }, B.token)
  expect(bridged?.ok).toBeTruthy()
  expect(bridged.marked, 'BRIDGE_MARKS_THE_THREAD_BELL').toBe(1)
  count = await rpc(request, 'signals_unread_count', {}, B.token)
  expect(count.count, 'THREAD_READ_MEANS_ZERO').toBe(0)
})

/* ---------------- B · the bell has a face ---------------- */
test('B · badge on the mark + inbox block render, and mark-all clears both', async ({ page, request }) => {
  test.setTimeout(120000)
  expect(A, 'NEEDS_TEST_A').toBeTruthy()
  // A rings B once more so B has exactly one unread
  const res = await rest(request, '/rest/v1/thread_messages', {
    method: 'POST', token: A.token,
    data: { thread_id: PLAN.thread_id, sender_id: A.uid, body: 'la campana de la UI' },
  })
  expect(res.status()).toBe(201)

  await signin(page, B.email, B.password)
  await page.goto('/messages')
  await expect(page.getByTestId('bell-badge').first(), 'BADGE_ON_THE_MARK').toBeVisible({ timeout: 15000 })
  // v16: The Bell dejó de ser un bloque arriba de SIGNALS — es un panel
  // detrás del ícono de campana del encabezado (bell-door). El gate se
  // actualiza a la superficie real: abrir la puerta, luego afirmar.
  await page.getByTestId('bell-door').click()
  await expect(page.getByTestId('bell-block'), 'BELL_PANEL_OPENS').toBeVisible()
  await expect(page.getByTestId('bell-row-message').first()).toBeVisible()
  await page.screenshot({ path: path.join(SHOTS, 'v10-bell-inbox.png'), fullPage: false })

  await page.getByTestId('bell-mark-all').click()
  await expect(page.getByTestId('bell-badge'), 'MARK_ALL_CLEARS_BADGE').toHaveCount(0, { timeout: 15000 })
  await page.screenshot({ path: path.join(SHOTS, 'v10-bell-read.png'), fullPage: false })
  await page.evaluate(() => localStorage.clear())
})

/* ---------------- C · the for-you payload is honest ---------------- */
test('C · a non-owner for-you carries is_demo:false on every row (0040)', async ({ request }) => {
  expect(A, 'NEEDS_TEST_A').toBeTruthy()
  const fy = await rpc(request, 'get_for_you', {}, A.token)
  expect(fy?.ok, 'GET_FOR_YOU_FAILED').toBeTruthy()
  const people = fy.people || []
  for (const p of people) {
    expect(p.is_demo, `SEED_IN_NON_OWNER_FEED: ${p.username || p.id}`).toBe(false)
  }
})

/* ---------------- D · the seed never leaks (v10 batch included) ---------------- */
test('D · anon + authed non-owner read zero seed; anon bells refuse politely', async ({ request }) => {
  // anon: the whole demo universe is invisible
  let res = await rest(request, '/rest/v1/profiles?is_demo=eq.true&select=id&limit=10')
  expect((await res.json()).length, 'ANON_SEED_LEAK').toBe(0)
  // anon: v10 spectrum usernames resolve to nothing
  res = await rest(request, '/rest/v1/profiles?username=in.(betofucho,ramirocepeda,normaalvarenga,obioraezenwa,hanhletters)&select=username')
  expect((await res.json()).length, 'ANON_V10_USERNAME_LEAK').toBe(0)
  // authed non-owner: same floor
  res = await rest(request, '/rest/v1/profiles?is_demo=eq.true&select=id&limit=10', { token: A.token })
  expect((await res.json()).length, 'AUTHED_SEED_LEAK').toBe(0)
  // anon bells: a polite no, never a row
  const anonBells = await rpc(request, 'my_signals', {})
  expect(anonBells?.ok).toBe(false)
  expect(anonBells?.error).toBe('not_authenticated')
  const anonCount = await rpc(request, 'signals_unread_count', {})
  expect(anonCount?.ok).toBe(false)
  // the emitter is triggers-only (0043 ACL fix): a client call must be
  // REFUSED — never a forged bell
  const forged = await rpc(request, 'notify_emit',
    { p_recipient: A.uid, p_actor: null, p_kind: 'friend_request', p_subject: {} }, A.token)
  expect(forged?.message || forged?.error || '', 'EMITTER_MUST_REFUSE_CLIENTS').toMatch(/permission denied|not.*find|404/i)
})

/* ---------------- E · retire the QA accounts ---------------- */
test('E · retire the QA users born in this run', async ({ page, request }) => {
  test.setTimeout(120000)
  if (!fs.existsSync(ACCTS)) return
  const lines = fs.readFileSync(ACCTS, 'utf8').trim().split('\n').filter(Boolean)
  for (const line of lines) {
    const acct = JSON.parse(line)
    await signin(page, acct.email, acct.password)
    const token = await grabToken(page)
    if (!token) continue
    await rest(request, `/rest/v1/profiles?id=eq.${acct.uid}`, {
      method: 'PATCH', token,
      data: { is_demo: true, username: null, full_name: 'QA (retired v10)' },
      headers: { Prefer: 'return=minimal' },
    })
    await page.evaluate(() => localStorage.clear())
  }
  fs.unlinkSync(ACCTS)
})
