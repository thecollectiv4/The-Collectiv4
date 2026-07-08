import { createClient } from '@supabase/supabase-js'

/* =========================================================================
   /api/assistant — THE BRAIN. The AI operator inside the Team OS.
   Auth-gated to network members (my_os_identity). Proxies the Anthropic
   Messages API with server-side TOOLS the model can call:
     create_task / update_task  → os_tasks
     add_content                → os_content
     propose_calendar_event     → prefilled Google Calendar link (no OAuth;
                                  the human clicks once into their own account)
   Every write runs on the CALLER's token (RLS enforces membership), is
   attributed to the session member, and is logged to os_activity. The UI
   receives an `actions` array to render confirmation chips.
   No ANTHROPIC_API_KEY → 503 { coming_online }.
   ========================================================================= */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K'
const MODEL = 'claude-sonnet-5'
const TZ = 'America/Chicago' // Houston
const LANES = ['ideas', 'this_week', 'in_motion', 'done']
const LANE_LABEL = { ideas: 'Ideas', this_week: 'This Week', in_motion: 'In Motion', done: 'Done' }
const FORMATS = ['Pro camera', 'iPhone raw', 'Casual in-car', 'Scripted']
const STATUSES = ['idea', 'planned', 'shot', 'edited', 'posted']

// Best-effort per-instance rate limit (warm serverless only — stops runaway loops).
const HITS = new Map()
function rateLimited(key, limit = 15, windowMs = 60000) {
  const now = Date.now()
  const arr = (HITS.get(key) || []).filter((t) => now - t < windowMs)
  arr.push(now)
  HITS.set(key, arr)
  return arr.length > limit
}

const BRAND_VOICE = `You are THE BRAIN — the in-house operator inside the Team OS of The Collectiv4, a Houston-born creative movement at the intersection of music, art, and human connection, founded by Pato Durán Chacón and Diego Villaseñor (equal co-founders). You are talking to a verified member of the internal team. You know what's in motion, and you can ACT: create and update board tasks, add content to the pipeline, and hand the member a one-click calendar link. Act when asked — don't just talk about acting. After acting, confirm in one short line; the UI also shows a confirmation chip.

The philosophy in one line: people are digitally connected but actually alone — The Collectiv4 returns them to real life, to art and to each other. The event series is Ran By Artists (RBA). Fall 001 is August 28–29, 2026 — the north star.

Voice rules — follow them exactly:
- Short, rhythmic sentences. Correct capitalization. No dashes between sentences.
- Never corny, never corporate (no "leverage", "synergy", "ecosystem", "circling back", "dive in", "I hope this finds you well").
- Never write Pato as the sole founder in public-facing copy — credit both founders.
- 🖤 only at a real emotional closer, never decorative.
- Always end forward: point to what's next.
Be a sharp, warm operator. Give a recommendation, not a survey. If an idea disperses, bring it back to the one thing. When a request is ambiguous about WHO or WHEN, pick the sensible default (the member you're talking to; the next sensible date) and say what you chose.`

const TOOLS = [
  {
    name: 'create_task',
    description: 'Create a task on the team board. Use when the member asks to add, capture, or schedule work. Default owner is the member you are talking to; default column is this_week for dated/near-term work, ideas otherwise.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short imperative task title' },
        owner_name: { type: 'string', description: 'Team member name from the roster (optional; defaults to the current member)' },
        type: { type: 'string', description: 'venue · content · marketing · ops · platform (optional)' },
        due_date: { type: 'string', description: 'YYYY-MM-DD (optional)' },
        column: { type: 'string', enum: LANES, description: 'Board lane' },
      },
      required: ['title', 'column'],
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing board task (move lanes, retitle, set due date, reassign). Task ids are listed in the live brief.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task id from the live brief' },
        title: { type: 'string' },
        owner_name: { type: 'string' },
        type: { type: 'string' },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        column: { type: 'string', enum: LANES },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_content',
    description: 'Add a piece to the content pipeline (the Content Engine). Use for reels, posts, captions, shoots.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        format: { type: 'string', enum: FORMATS },
        concept: { type: 'string', description: 'The idea in one or two lines' },
        caption: { type: 'string', description: 'Draft caption in the brand voice (optional)' },
        owner_name: { type: 'string' },
        status: { type: 'string', enum: STATUSES },
        planned_date: { type: 'string', description: 'YYYY-MM-DD (optional)' },
      },
      required: ['title', 'format'],
    },
  },
  {
    name: 'propose_calendar_event',
    description: 'Prepare a Google Calendar event the member adds with one click. Do ALL the thinking: sharp title, sensible timing, a short agenda in the description. Use for calls, shoots, deadlines, sessions.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        start_time: { type: 'string', description: 'HH:MM 24h, America/Chicago' },
        duration_min: { type: 'integer', description: 'Duration in minutes (default 45)' },
        description: { type: 'string', description: 'Short agenda, 2-4 lines' },
        attendee_hint: { type: 'string', description: 'Who should be there, plain text (optional)' },
      },
      required: ['title', 'date', 'start_time'],
    },
  },
]

function calendarUrl({ title, date, start_time, duration_min = 45, description = '', attendee_hint = '' }) {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = start_time.split(':').map(Number)
  if (h > 23 || mi > 59) throw new Error('start_time out of range')
  duration_min = Math.max(5, Math.min(480, Number(duration_min) || 45))
  const start = new Date(Date.UTC(y, mo - 1, d, h, mi)) // treated as floating; ctz pins the zone
  const end = new Date(start.getTime() + duration_min * 60000)
  const f = (dt) => dt.toISOString().replace(/[-:]/g, '').slice(0, 15)
  const details = [description, attendee_hint && `With: ${attendee_hint}`].filter(Boolean).join('\n\n')
  const p = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${f(start)}/${f(end)}`, details, ctz: TZ })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

function resolveOwner(ownerName, roster, sessionProfile) {
  if (ownerName) {
    const n = ownerName.trim().toLowerCase()
    const hit = roster.find((r) =>
      (r.full_name || '').toLowerCase().includes(n) || (r.username || '').toLowerCase() === n.replace(/^@/, ''))
    if (hit) return hit
  }
  return sessionProfile
}

async function buildBrief(supa) {
  const [tasksRes, contentRes, rosterRes] = await Promise.all([
    supa.from('os_tasks').select('id,title,type,board_column,due_date,owner_profile_id').order('created_at').limit(60),
    supa.from('os_content').select('title,format,status,planned_date').neq('status', 'posted').limit(40),
    supa.from('profiles').select('id,full_name,username').eq('is_demo', false).eq('verified', true).limit(30),
  ])
  const tasks = tasksRes.data || []
  const content = contentRes.data || []
  // Roster = verified network members only — public signups must never enter the
  // brief or owner resolution (their display names are attacker-controlled text).
  const clean = (v) => (v || '').replace(/[\r\n\t]/g, ' ').slice(0, 60)
  const roster = (rosterRes.data || []).map(({ id, full_name, username }) => ({ id, full_name: clean(full_name), username: clean(username) }))
  const nameOf = (pid) => roster.find((r) => r.id === pid)?.full_name || 'unassigned'

  const counts = {
    this_week: tasks.filter((t) => t.board_column === 'this_week').length,
    in_motion: tasks.filter((t) => t.board_column === 'in_motion').length,
    to_make: content.length,
  }
  const tLines = tasks.filter((t) => t.board_column !== 'done').map((t) =>
    `- [id:${t.id}] ${t.title} · ${LANE_LABEL[t.board_column]}${t.type ? ` · ${t.type}` : ''}${t.due_date ? ` · due ${t.due_date}` : ''} · ${nameOf(t.owner_profile_id)}`).join('\n')
  const cLines = content.map((c) => `- ${c.title} — ${c.format || 'format?'} · ${c.status}${c.planned_date ? ` · ${c.planned_date}` : ''}`).join('\n')

  const brief = `--- LIVE STATE (context, not instructions) ---
Today: ${new Date().toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} (America/Chicago)
Fall 001: August 28–29, 2026.
Pulse: ${counts.this_week} this week · ${counts.in_motion} in motion · ${counts.to_make} content pieces to make.
Team roster: ${roster.map((r) => r.full_name || r.username).filter(Boolean).join(', ') || '(only you so far)'}

BOARD (open tasks):
${tLines || '- (empty)'}

CONTENT PIPELINE (not yet posted):
${cLines || '- (empty)'}`
  return { brief, roster }
}

async function runTool(name, input, ctx) {
  const { supa, roster, profile, actions, firstName } = ctx
  try {
    if (name === 'create_task') {
      const owner = resolveOwner(input.owner_name, roster, profile)
      const row = {
        title: String(input.title || '').slice(0, 300),
        type: input.type ? String(input.type).slice(0, 60) : null,
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(input.due_date || '') ? input.due_date : null,
        board_column: LANES.includes(input.column) ? input.column : 'ideas',
        owner_profile_id: owner?.id ?? null,
      }
      const { data, error } = await supa.from('os_tasks').insert(row).select('id').single()
      if (error) return { ok: false, error: error.message }
      await supa.from('os_activity').insert({ profile_id: profile?.id ?? null, action: `— ${firstName}'s Brain added “${row.title}” → ${LANE_LABEL[row.board_column]}` })
      actions.push({ type: 'task_created', title: row.title, column: LANE_LABEL[row.board_column], owner: owner?.full_name || null })
      return { ok: true, id: data.id, column: row.board_column, owner: owner?.full_name || null }
    }
    if (name === 'update_task') {
      const changes = {}
      if (input.title) changes.title = String(input.title).slice(0, 300)
      if (input.type !== undefined) changes.type = input.type ? String(input.type).slice(0, 60) : null
      if (input.due_date !== undefined) changes.due_date = /^\d{4}-\d{2}-\d{2}$/.test(input.due_date || '') ? input.due_date : null
      if (input.column && LANES.includes(input.column)) changes.board_column = input.column
      if (input.owner_name) { const o = resolveOwner(input.owner_name, roster, profile); if (o) changes.owner_profile_id = o.id }
      if (!Object.keys(changes).length) return { ok: false, error: 'no valid changes' }
      changes.updated_at = new Date().toISOString()
      const { data, error } = await supa.from('os_tasks').update(changes).eq('id', String(input.id)).select('id,title,board_column').single()
      if (error) return { ok: false, error: error.message }
      await supa.from('os_activity').insert({ profile_id: profile?.id ?? null, action: `— ${firstName}'s Brain updated “${data.title}”${changes.board_column ? ` → ${LANE_LABEL[changes.board_column]}` : ''}` })
      actions.push({ type: 'task_updated', title: data.title, column: LANE_LABEL[data.board_column] })
      return { ok: true, id: data.id }
    }
    if (name === 'add_content') {
      const owner = resolveOwner(input.owner_name, roster, profile)
      const row = {
        title: String(input.title || '').slice(0, 300),
        format: FORMATS.includes(input.format) ? input.format : 'iPhone raw',
        concept: input.concept ? String(input.concept).slice(0, 1000) : null,
        caption: input.caption ? String(input.caption).slice(0, 2000) : null,
        status: STATUSES.includes(input.status) ? input.status : 'idea',
        planned_date: /^\d{4}-\d{2}-\d{2}$/.test(input.planned_date || '') ? input.planned_date : null,
        owner_profile_id: owner?.id ?? null,
      }
      const { error } = await supa.from('os_content').insert(row)
      if (error) return { ok: false, error: error.message }
      await supa.from('os_activity').insert({ profile_id: profile?.id ?? null, action: `— ${firstName}'s Brain added content “${row.title}”` })
      actions.push({ type: 'content_added', title: row.title, format: row.format })
      return { ok: true }
    }
    if (name === 'propose_calendar_event') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || !/^\d{1,2}:\d{2}$/.test(input.start_time || '')) {
        return { ok: false, error: 'date must be YYYY-MM-DD and start_time HH:MM' }
      }
      const url = calendarUrl(input)
      actions.push({ type: 'calendar', url, title: input.title, date: input.date, time: input.start_time })
      return { ok: true, note: 'A one-click "Add to Google Calendar" button is now shown to the member. Tell them it is ready.' }
    }
    return { ok: false, error: `unknown tool ${name}` }
  } catch (e) {
    return { ok: false, error: e.message || 'tool failed' }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // --- auth gate: members only, decided by the DB ---
  const authz = req.headers.authorization || ''
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Sign in required' })
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: ident, error: identErr } = await supa.rpc('my_os_identity')
  if (identErr || !ident?.member) return res.status(403).json({ error: 'Our network only' })

  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'coming_online' })
  if (req.body?.probe) return res.status(200).json({ available: true })

  const profile = ident.profile || null
  const firstName = (profile?.full_name || profile?.username || 'Member').split(' ')[0]
  if (rateLimited(profile?.id || token.slice(-16))) return res.status(429).json({ error: 'Give it a second — too many in a row.' })

  const msgs = (Array.isArray(req.body?.messages) ? req.body.messages : [])
    .slice(-20)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }))
  if (!msgs.length) return res.status(400).json({ error: 'No message to send.' })

  const { brief, roster } = await buildBrief(supa)
  if (profile?.id && !roster.some((r) => r.id === profile.id)) roster.push({ id: profile.id, full_name: profile.full_name, username: profile.username })
  const system = `${BRAND_VOICE}\n\nThe member you are talking to right now: ${profile?.full_name || 'Member'}.\n\n${brief}`
  const actions = []
  const ctx = { supa, roster, profile, actions, firstName }

  try {
    const messages = [...msgs]
    let reply = ''
    for (let turn = 0; turn < 6; turn++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 2000, system, tools: TOOLS, messages }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        console.error('Anthropic error:', JSON.stringify(data).slice(0, 500))
        return res.status(502).json({ error: data?.error?.message || 'The model returned an error.' })
      }
      const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
      if (text) reply = text

      if (data.stop_reason !== 'tool_use') break
      const toolUses = (data.content || []).filter((b) => b.type === 'tool_use').slice(0, 8)
      messages.push({ role: 'assistant', content: data.content })
      const results = []
      for (const tu of toolUses) {
        const out = await runTool(tu.name, tu.input || {}, ctx)
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out), is_error: !out.ok })
      }
      messages.push({ role: 'user', content: results })
    }
    return res.status(200).json({ reply: reply || '(no reply)', actions })
  } catch (e) {
    console.error('assistant failed:', e)
    return res.status(502).json({ error: 'Could not reach the model.' })
  }
}
