/* =========================================================================
   assistant.harness.mjs — offline test harness for /api/assistant (THE BRAIN).

   Drives the exported handler end-to-end with BOTH seams mocked:
     - '@supabase/supabase-js' is swapped for an in-memory fake via a Node
       loader hook (module.register) → ZERO live DB reads or writes.
     - global.fetch is scripted per test → ZERO live Anthropic calls.

   Covers the auth gate (401/403/503/probe), the destructive confirmation
   protocol (marker code-check on the LATEST user message), update_content
   validation incl. the brief cap, add_content brief persistence, owner
   resolution fallback, the ACTION INTEGRITY backstop (unexecuted_claims is
   set when the reply claims an action but ZERO tools ran; absent for
   proposals and whenever a tool executed), and the IDENTITY rule (actor is
   always the JWT-derived session profile — "hey its drizzy" in message text
   never changes attribution or default ownership; owner_name delegation to
   a VERIFIED roster member works, attribution still names the session member).

   Run:  node scripts/assistant.harness.mjs
   ========================================================================= */

import { register } from 'node:module'

// --- swap @supabase/supabase-js for a virtual module before importing the handler ---
const loaderSrc = `
export function resolve(specifier, context, next) {
  if (specifier === '@supabase/supabase-js') return { url: 'virtual:supabase-mock', shortCircuit: true }
  return next(specifier, context)
}
export function load(url, context, next) {
  if (url === 'virtual:supabase-mock') return { format: 'module', source: 'export const createClient = (...a) => globalThis.__createClient(...a)', shortCircuit: true }
  return next(url, context)
}`
register('data:text/javascript,' + encodeURIComponent(loaderSrc))

const { default: handler } = await import(new URL('../api/assistant.js', import.meta.url).href)

// ------------------------------ mock supabase ------------------------------
function makeSupa(state) {
  const log = { inserts: [], updates: [], deletes: [] }
  const tableRows = (t) =>
    t === 'os_tasks' ? state.tasks : t === 'os_content' ? state.content
    : t === 'profiles' ? state.profiles : t === 'os_activity' ? state.activity : []

  function builder(table) {
    const q = { op: 'select', filters: [], neqs: [], row: null, single: false, maybe: false }
    const exec = () => {
      const rows = tableRows(table)
      const match = (r) => q.filters.every(([k, v]) => String(r[k]) === String(v)) && q.neqs.every(([k, v]) => r[k] !== v)
      if (q.op === 'insert') {
        const row = { id: `${table}-new-${rows.length + 1}`, ...q.row }
        rows.push(row)
        log.inserts.push({ table, row })
        return { data: q.single ? row : [row], error: null }
      }
      if (q.op === 'update') {
        const hits = rows.filter(match)
        hits.forEach((r) => Object.assign(r, q.row))
        log.updates.push({ table, changes: q.row, filters: [...q.filters] })
        if (q.single) return hits.length === 1 ? { data: hits[0], error: null } : { data: null, error: { message: hits.length ? 'multiple rows' : 'no rows found' } }
        return { data: hits, error: null }
      }
      if (q.op === 'delete') {
        const hits = rows.filter(match)
        log.deletes.push({ table, filters: [...q.filters], count: hits.length })
        for (const h of hits) rows.splice(rows.indexOf(h), 1)
        return { data: null, error: null }
      }
      const hits = rows.filter(match)
      if (q.single) {
        if (q.maybe) return { data: hits[0] || null, error: null }
        return hits.length === 1 ? { data: hits[0], error: null } : { data: null, error: { message: 'expected a single row' } }
      }
      return { data: hits, error: null }
    }
    const api = {
      select: () => api,
      eq: (k, v) => { q.filters.push([k, v]); return api },
      neq: (k, v) => { q.neqs.push([k, v]); return api },
      order: () => api,
      limit: () => api,
      insert: (row) => { q.op = 'insert'; q.row = row; return api },
      update: (row) => { q.op = 'update'; q.row = row; return api },
      delete: () => { q.op = 'delete'; return api },
      single: () => { q.single = true; return api },
      maybeSingle: () => { q.single = true; q.maybe = true; return api },
      then: (res, rej) => Promise.resolve().then(exec).then(res, rej),
    }
    return api
  }

  return {
    log,
    state,
    rpc: async (fn) => (fn === 'my_os_identity' ? { data: state.identity, error: null } : { data: null, error: { message: `unknown rpc ${fn}` } }),
    from: (table) => builder(table),
  }
}

// ------------------------------ mock anthropic -----------------------------
function scriptAnthropic(responses) {
  const calls = []
  globalThis.fetch = async (url, opts) => {
    if (!String(url).includes('api.anthropic.com')) throw new Error(`harness: unexpected fetch to ${url}`)
    calls.push(JSON.parse(opts.body))
    const next = responses.shift() || { content: [{ type: 'text', text: 'done.' }], stop_reason: 'end_turn' }
    return { ok: true, json: async () => next }
  }
  return calls
}
const toolUse = (name, input, id = 'tu-1') => ({ content: [{ type: 'tool_use', id, name, input }], stop_reason: 'tool_use' })
const finalText = (text = 'Done.') => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })

// ------------------------------ req/res fakes ------------------------------
const makeReq = ({ token = 'tok-abc', body } = {}) => ({ method: 'POST', headers: { authorization: token ? `Bearer ${token}` : '' }, body })
const makeRes = () => {
  const r = { statusCode: null, body: null }
  r.status = (c) => { r.statusCode = c; return r }
  r.json = (b) => { r.body = b; return r }
  return r
}

// ------------------------------ fixtures -----------------------------------
let profileSeq = 0
function freshState() {
  const pid = `p-${++profileSeq}` // unique per test → no cross-test rate limiting
  return {
    identity: { member: true, profile: { id: pid, full_name: 'Pato Durán', username: 'pato' } },
    profiles: [{ id: pid, full_name: 'Pato Durán', username: 'pato', is_demo: false, verified: true }],
    tasks: [{ id: 'task-1', title: 'Lock the venue', type: 'venue', due_date: null, board_column: 'this_week', owner_profile_id: pid }],
    content: [{ id: 'cont-1', title: 'Rooftop reel', format: 'iPhone raw', concept: null, caption: null, status: 'idea', planned_date: null, brief: null, owner_profile_id: pid }],
    activity: [],
  }
}
async function drive({ state, messages, responses, token = 'tok-abc' }) {
  const supa = makeSupa(state)
  globalThis.__createClient = () => supa
  const calls = scriptAnthropic(responses || [])
  const res = makeRes()
  await handler(makeReq({ token, body: { messages } }), res)
  return { supa, calls, res }
}
const lastToolResult = (calls) => {
  const last = calls[calls.length - 1]
  const block = last.messages[last.messages.length - 1].content.find((b) => b.type === 'tool_result')
  return JSON.parse(block.content)
}

// ------------------------------ test runner --------------------------------
let pass = 0
let fail = 0
const failures = []
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`) }
  else { fail++; failures.push(name); console.log(`  FAIL ${name}`) }
}

process.env.ANTHROPIC_API_KEY = 'test-key-not-real'

// 1 — 401 without token
{
  const res = makeRes()
  globalThis.__createClient = () => { throw new Error('should not build a client without a token') }
  await handler(makeReq({ token: '', body: { messages: [{ role: 'user', content: 'hi' }] } }), res)
  check('401 without token', res.statusCode === 401)
}

// 2 — 403 non-member
{
  const state = freshState()
  state.identity = { member: false }
  const { res } = await drive({ state, messages: [{ role: 'user', content: 'hi' }] })
  check('403 non-member', res.statusCode === 403)
}

// 3 — 503 without ANTHROPIC_API_KEY
{
  delete process.env.ANTHROPIC_API_KEY
  const { res } = await drive({ state: freshState(), messages: [{ role: 'user', content: 'hi' }] })
  check('503 coming_online without key', res.statusCode === 503 && res.body?.error === 'coming_online')
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
}

// 4 — probe short-circuits as available
{
  const supa = makeSupa(freshState())
  globalThis.__createClient = () => supa
  globalThis.fetch = async () => { throw new Error('probe must not call the model') }
  const res = makeRes()
  await handler(makeReq({ body: { probe: true } }), res)
  check('probe → { available: true }', res.statusCode === 200 && res.body?.available === true)
}

// 5 — delete_task WITHOUT marker → refused + confirm_delete chip
{
  const state = freshState()
  const { supa, calls, res } = await drive({
    state,
    messages: [{ role: 'user', content: 'delete the venue task' }],
    responses: [toolUse('delete_task', { id: 'task-1' }), finalText()],
  })
  const tr = lastToolResult(calls)
  const chip = res.body.actions.find((a) => a.type === 'confirm_delete')
  check('no marker → zero deletes on supa', supa.log.deletes.length === 0)
  check('no marker → row survives', state.tasks.some((t) => t.id === 'task-1'))
  check('no marker → tool_result needs_confirmation', tr.ok === false && tr.needs_confirmation === true)
  check('no marker → confirm_delete action w/ DB title', chip && chip.kind === 'task' && chip.id === 'task-1' && chip.title === 'Lock the venue')
}

// 6 — delete_task WITH exact marker as latest user message → executes
{
  const state = freshState()
  const { supa, res } = await drive({
    state,
    messages: [
      { role: 'user', content: 'delete the venue task' },
      { role: 'assistant', content: 'That would remove “Lock the venue”. Hit confirm.' },
      { role: 'user', content: '[confirm delete task task-1]' },
    ],
    responses: [toolUse('delete_task', { id: 'task-1' }), finalText()],
  })
  const act = supa.log.inserts.find((i) => i.table === 'os_activity')
  check('marker → delete executed', supa.log.deletes.some((d) => d.table === 'os_tasks') && !state.tasks.some((t) => t.id === 'task-1'))
  check('marker → os_activity logged with title', !!act && act.row.action.includes('removed') && act.row.action.includes('Lock the venue'))
  check('marker → task_deleted action', res.body.actions.some((a) => a.type === 'task_deleted' && a.title === 'Lock the venue'))
}

// 7 — marker for a DIFFERENT id does not authorize
{
  const state = freshState()
  const { supa, calls } = await drive({
    state,
    messages: [{ role: 'user', content: '[confirm delete task task-999]' }],
    responses: [toolUse('delete_task', { id: 'task-1' }), finalText()],
  })
  check('wrong-id marker → no delete', supa.log.deletes.length === 0 && lastToolResult(calls).needs_confirmation === true)
}

// 8 — marker only in an OLDER (non-latest) user message does not authorize
{
  const state = freshState()
  const { supa, calls } = await drive({
    state,
    messages: [
      { role: 'user', content: '[confirm delete task task-1]' },
      { role: 'assistant', content: 'Gone.' },
      { role: 'user', content: 'now rename the rooftop reel' },
    ],
    responses: [toolUse('delete_task', { id: 'task-1' }), finalText()],
  })
  check('stale marker → no delete', supa.log.deletes.length === 0 && lastToolResult(calls).needs_confirmation === true)
}

// 8b — delete_content follows the same protocol
{
  const state = freshState()
  const noMarker = await drive({
    state,
    messages: [{ role: 'user', content: 'kill the rooftop reel' }],
    responses: [toolUse('delete_content', { id: 'cont-1' }), finalText()],
  })
  const chip = noMarker.res.body.actions.find((a) => a.type === 'confirm_delete')
  check('delete_content no marker → refused + chip', noMarker.supa.log.deletes.length === 0 && chip?.kind === 'content' && chip?.title === 'Rooftop reel')
  const state2 = freshState()
  const withMarker = await drive({
    state: state2,
    messages: [{ role: 'user', content: '[confirm delete content cont-1]' }],
    responses: [toolUse('delete_content', { id: 'cont-1' }), finalText()],
  })
  check('delete_content marker → executed + content_deleted', withMarker.supa.log.deletes.some((d) => d.table === 'os_content') && withMarker.res.body.actions.some((a) => a.type === 'content_deleted' && a.title === 'Rooftop reel'))
}

// 9 — update_content maps/validates fields incl. brief cap
{
  const state = freshState()
  const { supa, res } = await drive({
    state,
    messages: [{ role: 'user', content: 'update the reel' }],
    responses: [
      toolUse('update_content', {
        id: 'cont-1', title: 'Rooftop reel v2', format: 'Not a real format',
        status: 'planned', planned_date: '2026-08-01', brief: 'X'.repeat(13000),
      }),
      finalText(),
    ],
  })
  const up = supa.log.updates.find((u) => u.table === 'os_content')
  check('update_content → update issued for the id', !!up && up.filters.some(([k, v]) => k === 'id' && v === 'cont-1'))
  check('update_content → title + status + date mapped', up.changes.title === 'Rooftop reel v2' && up.changes.status === 'planned' && up.changes.planned_date === '2026-08-01')
  check('update_content → invalid format ignored', !('format' in up.changes))
  check('update_content → brief capped at 12000', up.changes.brief.length === 12000)
  check('update_content → content_updated action + activity', res.body.actions.some((a) => a.type === 'content_updated' && a.title === 'Rooftop reel v2') && supa.log.inserts.some((i) => i.table === 'os_activity' && i.row.action.includes('updated content')))
}

// 10 — add_content persists brief
{
  const state = freshState()
  const brief = 'LOCATION\nEast End rooftop at golden hour.\n\nSHOTLIST\n01 wide of the skyline\n02 close on hands'
  const { supa, res } = await drive({
    state,
    messages: [{ role: 'user', content: 'log this concept' }],
    responses: [toolUse('add_content', { title: 'Golden hour teaser', format: 'Pro camera', concept: 'Skyline teaser', brief }), finalText()],
  })
  const ins = supa.log.inserts.find((i) => i.table === 'os_content')
  check('add_content → brief persisted verbatim', ins?.row.brief === brief)
  check('add_content → content_added action', res.body.actions.some((a) => a.type === 'content_added' && a.title === 'Golden hour teaser'))
}

// 11 — owner_name that is not on the roster falls back to the session profile
{
  const state = freshState()
  const sessionId = state.identity.profile.id
  const { supa } = await drive({
    state,
    messages: [{ role: 'user', content: 'task for Zzz' }],
    responses: [toolUse('create_task', { title: 'Ghost task', column: 'ideas', owner_name: 'Zzz Nobody' }), finalText()],
  })
  const ins = supa.log.inserts.find((i) => i.table === 'os_tasks')
  check('non-roster owner_name → session profile owns it', ins?.row.owner_profile_id === sessionId)
}

// 12 — ACTION INTEGRITY: first-person action claim with ZERO tool calls
//      → unexecuted_claims:true and zero DB writes (the live-preview bug, verbatim)
{
  const state = freshState()
  const { supa, res } = await drive({
    state,
    messages: [{ role: 'user', content: 'get the edit moving and lock the sessions' }],
    responses: [finalText("I'm putting an edit task on the board and locking two sessions on the calendar.")],
  })
  check('claim w/o tools → unexecuted_claims:true', res.statusCode === 200 && res.body.unexecuted_claims === true)
  check('claim w/o tools → zero DB writes', supa.log.inserts.length === 0 && supa.log.updates.length === 0 && supa.log.deletes.length === 0)
  check('claim w/o tools → no action chips', (res.body.actions || []).length === 0)
}

// 12b — benign non-claim reply (a proposal) → flag ABSENT
{
  const { res } = await drive({
    state: freshState(),
    messages: [{ role: 'user', content: 'thoughts on the board?' }],
    responses: [finalText('The board looks tight. Want me to add it?')],
  })
  check('proposal → unexecuted_claims absent', res.statusCode === 200 && !('unexecuted_claims' in res.body))
}

// 12c — a tool DID execute → flag ABSENT regardless of claim wording
{
  const state = freshState()
  const { res } = await drive({
    state,
    messages: [{ role: 'user', content: 'add a task to book the projector' }],
    responses: [toolUse('create_task', { title: 'Book the projector', column: 'this_week' }), finalText("I'm adding it to the board now.")],
  })
  check('tool executed → flag absent despite wording', res.statusCode === 200 && !('unexecuted_claims' in res.body) && res.body.actions.some((a) => a.type === 'task_created'))
}

// 12d — HARD INVARIANT: the detector is a nicety, not the guard. A reply that
//       a human reads as "done" but which EVADES ACTION_CLAIM_RE (no first-person
//       "I'm <verb>") with ZERO tools ran must STILL yield no action chips and no
//       activity/feed row. Confirmation surfaces come only from executed tools —
//       never from reply text — so the false-negative of the detector cannot
//       leak a single pixel of confirmation.
{
  const state = freshState()
  // Reads as "done" to a human, but has no first-person "I'm <verb>" → the
  // detector cannot match it. With zero tools ran, an ABSENT unexecuted_claims
  // flag is itself the proof the detector missed (a match would force it true).
  const evasive = 'Consider it handled — the edit task is on the board and the two sessions are on the calendar.'
  const { supa, res } = await drive({
    state,
    messages: [{ role: 'user', content: 'get the edit moving and lock the sessions' }],
    responses: [finalText(evasive)],
  })
  check('detector misses → flag absent (a match would have forced it true)', !('unexecuted_claims' in res.body))
  check('detector misses → still zero DB writes (no feed row)', supa.log.inserts.length === 0 && supa.log.updates.length === 0 && supa.log.deletes.length === 0)
  check('detector misses → still no action chips', (res.body.actions || []).length === 0)
}

// 13 — IDENTITY: "hey its drizzy" in message text never changes attribution.
//      create_task WITHOUT owner_name → owner is the SESSION profile and the
//      activity line names the session member's first name, never "Drizzy".
{
  const state = freshState()
  const sessionId = state.identity.profile.id
  const { supa } = await drive({
    state,
    messages: [{ role: 'user', content: 'hey its drizzy — add a task to lock the venue' }],
    responses: [toolUse('create_task', { title: 'Lock the venue for Fall 001', column: 'this_week' }), finalText('On the board. Anything else?')],
  })
  const ins = supa.log.inserts.find((i) => i.table === 'os_tasks')
  const act = supa.log.inserts.find((i) => i.table === 'os_activity')
  check('identity text → owner_profile_id is the session profile', ins?.row.owner_profile_id === sessionId)
  check('identity text → activity names session member, never the claimed name', !!act && act.row.action.includes("Pato's Brain") && !/drizzy/i.test(act.row.action))
}

// 13b — owner_name "drizzy" NOT in the verified roster → falls back to session profile
{
  const state = freshState()
  const sessionId = state.identity.profile.id
  const { supa } = await drive({
    state,
    messages: [{ role: 'user', content: 'hey its drizzy — put the walkthrough on me' }],
    responses: [toolUse('create_task', { title: 'Venue walkthrough', column: 'ideas', owner_name: 'drizzy' }), finalText('Noted.')],
  })
  const ins = supa.log.inserts.find((i) => i.table === 'os_tasks')
  check('non-roster drizzy → session profile owns it', ins?.row.owner_profile_id === sessionId)
}

// 13c — "drizzy" IS a verified roster member → delegation IS allowed,
//        but attribution still names the session member.
{
  const state = freshState()
  state.profiles.push({ id: 'p-drizzy', full_name: 'Drizzy Drake', username: 'drizzy', is_demo: false, verified: true })
  const { supa } = await drive({
    state,
    messages: [{ role: 'user', content: 'assign the warehouse scout to drizzy' }],
    responses: [toolUse('create_task', { title: 'Scout the warehouse', column: 'this_week', owner_name: 'drizzy' }), finalText('Assigned.')],
  })
  const ins = supa.log.inserts.find((i) => i.table === 'os_tasks')
  const act = supa.log.inserts.find((i) => i.table === 'os_activity')
  check('verified drizzy → delegation lands on his profile', ins?.row.owner_profile_id === 'p-drizzy')
  check('delegation → attribution still names the session member', !!act && act.row.action.includes("Pato's Brain") && !act.row.action.includes("Drizzy's Brain"))
}

console.log(`\n${pass} passed · ${fail} failed${fail ? ` → ${failures.join(' | ')}` : ''}`)
process.exit(fail ? 1 : 0)
