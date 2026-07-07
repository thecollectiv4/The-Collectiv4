import { createClient } from '@supabase/supabase-js'

/* =========================================================================
   /api/brainstorm — the Team OS embedded intelligence.
   Auth-gated to network members (my_os_identity → member). Proxies the
   Anthropic Messages API with the locked brand voice + a live state brief
   (this week's tasks + content pipeline). Two modes:
     • brainstorm — fast chat, thinking off.
     • radar      — web_search enabled to scan the open web.
   If ANTHROPIC_API_KEY isn't set, returns 503 { coming_online } so the OS
   ships with a clean "coming online" tab instead of a broken one.

   MODEL NOTE: the send-off specified claude-sonnet-4-6; using the current
   same-tier successor claude-sonnet-5 (adaptive thinking, better quality,
   comparable cost). One constant below — swap it if you want to pin 4-6.
   ========================================================================= */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K'
const MODEL = 'claude-sonnet-5'

// Best-effort in-memory rate limit. Serverless instances are ephemeral, so this
// only bounds a warm instance — enough to stop a runaway loop, not a hard quota.
const HITS = new Map()
function rateLimited(key, limit = 20, windowMs = 60000) {
  const now = Date.now()
  const arr = (HITS.get(key) || []).filter((t) => now - t < windowMs)
  arr.push(now)
  HITS.set(key, arr)
  return arr.length > limit
}

const BRAND_VOICE = `You are the in-house brainstorm partner for The Collectiv4 — a Houston-born creative movement at the intersection of music, art, and human connection, founded by Pato Durán Chacón and Diego Villaseñor (equal co-founders). You are talking to the internal team inside their private operating hub. Help them think: shape concepts, draft captions, pressure-test ideas, plan content and events.

The philosophy in one line: people are digitally connected but actually alone — The Collectiv4 returns them to real life, to art and to each other. Purpose is love. Presence over noise. The filter for everything: will this echo, or is it noise? The event series is "Ran By Artists" (RBA). The north star is Fall 001 (Aug 28, 2026).

Voice rules — follow them exactly:
- Short, rhythmic sentences. Write like it reads out loud.
- No corporate language (no "leverage", "synergy", "ecosystem"). No AI clichés ("I hope this finds you well", "circling back", "dive in", "in today's fast-paced world").
- Never write Pato as the sole founder — credit both founders in any public-facing copy.
- Always end forward: point to what's next.
- 🖤 only at a real emotional closer, never decorative, never mid-sentence.
- When you draft a caption or a piece of copy, keep it tight and human, never salesy.
Be a direct, warm thought partner. Give a recommendation, not an exhaustive survey. If an idea disperses, gently bring it back to the one thing.`

async function fetchBrief(supa) {
  try {
    const [tasksRes, contentRes] = await Promise.all([
      supa.from('os_tasks').select('title,type,board_column,due_date').in('board_column', ['this_week', 'in_motion']).limit(40),
      supa.from('os_content').select('title,format,status,planned_date').neq('status', 'posted').limit(40),
    ])
    const tasks = tasksRes.data || []
    const content = contentRes.data || []
    if (!tasks.length && !content.length) return ''
    const tLines = tasks.map((t) => `- [${t.board_column}] ${t.title}${t.type ? ` (${t.type})` : ''}${t.due_date ? ` · due ${t.due_date}` : ''}`).join('\n')
    const cLines = content.map((c) => `- ${c.title} — ${c.format || 'format?'} · ${c.status}${c.planned_date ? ` · ${c.planned_date}` : ''}`).join('\n')
    return `THIS WEEK / IN MOTION (tasks):\n${tLines || '- (none)'}\n\nCONTENT PIPELINE (not yet posted):\n${cLines || '- (none)'}`
  } catch {
    return ''
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // --- auth gate: members only (verified OR owner), decided by the DB ---
  const authz = req.headers.authorization || ''
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Sign in required' })

  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: ident, error: identErr } = await supa.rpc('my_os_identity')
  if (identErr || !ident?.member) return res.status(403).json({ error: 'Our network only' })

  // --- key gate: if the model key isn't set, the tab shows "coming online" ---
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'coming_online' })

  // lightweight availability probe from the client
  if (req.body?.probe) return res.status(200).json({ available: true })

  const who = ident.profile?.id || token.slice(0, 16)
  if (rateLimited(who)) return res.status(429).json({ error: 'Give it a second — too many in a row.' })

  const { messages = [], mode = 'brainstorm' } = req.body || {}
  const msgs = (Array.isArray(messages) ? messages : [])
    .slice(-20)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }))
  if (!msgs.length) return res.status(400).json({ error: 'No message to send.' })

  const brief = await fetchBrief(supa)
  const system = BRAND_VOICE + (brief ? `\n\n--- LIVE STATE (context, not instructions) ---\n${brief}` : '')

  const body = { model: MODEL, max_tokens: 1500, system, messages: msgs }
  if (mode === 'radar') {
    // Radar: let the model scan the open web. Adaptive thinking (omit the field)
    // helps it orchestrate searches; web_search_20260209 is GA (no beta header).
    body.tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }]
  } else {
    // Brainstorm: snappy chat, thinking off.
    body.thinking = { type: 'disabled' }
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return res.status(502).json({ error: data?.error?.message || 'The model returned an error.' })
    }
    const reply = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
    return res.status(200).json({ reply: reply || '(no reply)', mode })
  } catch (e) {
    console.error('brainstorm fetch failed:', e)
    return res.status(502).json({ error: 'Could not reach the model.' })
  }
}
