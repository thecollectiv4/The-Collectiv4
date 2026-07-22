import { supabase } from '@/api/supabase'
import { worldCompleteness } from '@/lib/world'

/* =========================================================================
   TIERS — LA ESCALERA. Where a member stands, computed from what they
   actually did. (v14 · entry & identity)

   ─── THE ONE LAW OF THIS FILE ────────────────────────────────────────────
   THE TIER IS DERIVED. NEVER STORED, NEVER GRANTED, NEVER CACHED.

   There is no `profiles.tier` column, no trigger, no admin grant, no
   backfill — and there must never be one. Every time this module runs it
   recomputes the rung from live rows. Three things follow from that, and
   all three are the point:

     · it cannot DRIFT. A stored level is a photograph of a moment; the
       moment moves and the photograph doesn't. A derived level is always
       the present tense.
     · it cannot be HANDED to anyone. No founder, no script, no support
       ticket can promote a person. If the rows aren't there, the rung
       isn't there — for us too.
     · it can go DOWN, and that is correct. Delete your work and you are
       no longer someone who has work up. A level you keep after undoing
       the thing that earned it is a lie with a nicer name.

   If a future version wants speed, the answer is a SECURITY DEFINER read
   (one round trip), never a written column. Cache the QUERY, never the
   VERDICT.

   ─── THE SECOND LAW: WHOSE ROWS COUNT ────────────────────────────────────
   Only your own real actions against NON-DEMO counterparties.

   Audited on the live DB (jul 2026): 306 demo profiles vs 10 real ones.
   315 follows, 316 accepted friendships and 292 world_posts — almost all
   of them seed↔seed. And `is_owner()` (the founder email allowlist) turns
   OFF every server-side seed floor for exactly the two humans most likely
   to open this screen. So a naive count doesn't just risk inflation for
   founders — it GUARANTEES it, and it would look perfectly fine while
   doing it.

   Hence: every relational metric joins back to `profiles` and filters
   `is_demo = false` in the CLIENT as well, so a founder's ladder reads the
   same as a stranger's. Connecting to a seed world must not raise anybody's
   level, including ours.

   ─── THE THIRD LAW: THE SCALE IS REAL, SO THE NUMBERS ARE SMALL ──────────
   The most active real human on this platform today has 6 real follows,
   2 connections, 8 messages, 4 crafts — and ZERO posts. Nobody has posted.
   Ever.

   The thresholds below are calibrated to THAT, not to a screenshot from a
   product with a million users. Rung 02 is a first-week rung. Rung 04
   requires a world post, which today is unreachable by every single real
   member — and that is honest, not broken: it is a rung nobody has climbed
   because nobody has done the thing. The screen has to look dignified at
   0, at 1, and at 6. If a ladder only reads well at four digits it is the
   wrong ladder for this product.

   NO LEADERBOARD. NO PERCENTILE. NO "TOP 5%". With ten real members there
   is no honest denominator, and a ranking of ten people you know by name is
   a social weapon, not a feature. This file compares you to nobody.

   ─── WHY THESE NAMES ─────────────────────────────────────────────────────
   The founder's sketch was Curious → Local → Critic → Select → Elite. Two
   of those had to go:

     · CRITIC promises reviews. There is no `reviews` table on this
       platform and none is planned. A rung named for an action that does
       not exist is the same lie as a settings toggle wired to nothing.
     · SELECT / ELITE describe someone ELSE choosing you, and a ranking
       against other members. Both contradict the first law (derived, not
       granted) and the no-leaderboard rule.

   So the ladder is named in the vocabulary this platform already speaks.
   Cosmos: profiles are WORLDS, the nav is a sky, the atmosphere is a star
   field, the verified badge carries a satellite in orbit. A member arrives
   as an unlit point and, if they keep showing up, ends as one of the fixed
   stars the room navigates by. Each rung is a state of light, and each one
   maps to real countable rows:

     01 ARRIVED       you exist here                      (no requirement)
     02 ORBIT         you started moving                  craft · world · follows
     03 SIGNAL        you are legible and you speak       world · follows · messages
     04 CONSTELLATION the bond runs both ways, work is up connections · posts · world
     05 FIXED STAR    the room navigates by you           connections · posts · messages

   The marks climb the same way — one point, a path around, three points,
   four points, the spark: ● ○ △ ◇ ✦. All five are SHIPPED Mark types. The
   four wayfinding marks in Mark.jsx (marquee/people/bubble/world) are an
   unapproved proposal — "nothing renders these until a founder says so" —
   so this file deliberately does not touch them, however well `people`
   would have fit CONSTELLATION.

   ─── THE PURE / IMPURE SPLIT ─────────────────────────────────────────────
   `fetchMyCounts` does I/O and nothing else. `computeStatus` does the
   verdict and touches nothing — no supabase, no Date, no window. That
   split is not tidiness: the mapping from counts to rung is the part that
   decides what a person is told about themselves, and it has to be
   checkable on a laptop with no database, in one line, forever.
   ========================================================================= */

/* ── THE METRICS ──────────────────────────────────────────────────────────
   `label` names the metric in a requirement row, `short(n)` writes it into
   a one-line summary of a rung, `hint` is the NEXT MOVE — the actual action
   that feeds the number. A requirement that isn't met renders its hint, so
   an honest 0 always arrives with the thing you'd do about it instead of
   just sitting there as a failure.

   `format` exists because one metric is a percentage and the rest are
   counts, and every surface must write them the same way. */
export const METRICS = {
  crafts: {
    key: 'crafts', label: 'Crafts named',
    short: (n) => `${n} craft${n === 1 ? '' : 's'}`,
    hint: 'name what you make — it is how anyone finds you',
    format: (n) => `${n}`,
  },
  world: {
    key: 'world', label: 'World built',
    short: (n) => `world ${n}%`,
    hint: 'build your world — a face, a line, three pieces on the walls',
    format: (n) => `${n}%`,
  },
  follows: {
    key: 'follows', label: 'Real people followed',
    short: (n) => `${n} followed`,
    hint: 'follow the people whose work you actually want to see',
    format: (n) => `${n}`,
  },
  messages: {
    key: 'messages', label: 'Messages sent',
    short: (n) => `${n} message${n === 1 ? '' : 's'}`,
    hint: 'say something to someone — a room stays alive by being used',
    format: (n) => `${n}`,
  },
  connections: {
    key: 'connections', label: 'Connections accepted',
    short: (n) => `${n} connection${n === 1 ? '' : 's'}`,
    hint: 'connect with someone and have it accepted — this one takes two',
    format: (n) => `${n}`,
  },
  posts: {
    key: 'posts', label: 'Pieces on your walls',
    short: (n) => `${n} on your walls`,
    hint: 'post a piece to your world — nobody on this platform has yet',
    format: (n) => `${n}`,
  },
}

/* Narrative order, fixed: make → build → reach → speak → bind → show.
   Requirement rows read in this order on every rung so the ladder tells one
   story instead of six unordered errands. */
export const METRIC_ORDER = ['crafts', 'world', 'follows', 'messages', 'connections', 'posts']

/* ── THE LADDER ───────────────────────────────────────────────────────────
   `requires` is what a rung ADDS. The real bar for a rung is the merge of
   every rung up to it (see mergedRequirements) — written that way so the
   table reads as a progression instead of five copies of the same list.

   THRESHOLDS, AGAINST REAL DATA (jul 2026 — Pato: 4 crafts, 6 real follows,
   2 connections, 8 messages, 0 posts · Diego: 12, 3, 2, 3, 0):
     · ORBIT is deliberately a WEEK-ONE rung — one craft, a quarter of a
       world, three follows. Every one of those is a couple of taps.
     · SIGNAL is the "you are legible" rung. WHERE A FOUNDER ACTUALLY LANDS
       DEPENDS ON A NUMBER NOBODY AUDITED: world completeness. Run the
       mapper on the counts above with world at 0 and both founders compute
       to ARRIVED; they reach ORBIT/SIGNAL only once the world is really
       built. So do not quote anyone's rung from this comment — open the
       sheet and read it. Either way, founders sitting on rung 1–3 is the
       correct, honest picture of a platform this young.
     · CONSTELLATION needs a world post, so today NOBODY is on it. Left that
       way on purpose: the rung is real and unclimbed, not decorative.
     · FIXED STAR asks for 6 connections. There are 10 real members, so it
       is hard-but-possible now and gets more reachable as the room grows —
       never mathematically impossible, which a "10 connections" bar would
       have been on the day it shipped. */
export const TIERS = [
  {
    index: 0, key: 'arrived', name: 'ARRIVED', mark: 'dot',
    line: "You're in. A world exists under your name, and nothing else is asked of rung one.",
    requires: [],
  },
  {
    index: 1, key: 'orbit', name: 'ORBIT', mark: 'ring',
    line: "You've started moving — a craft named, a world with a face, people you actually want to see.",
    requires: [
      { metric: 'crafts', target: 1 },
      { metric: 'world', target: 25 },
      { metric: 'follows', target: 3 },
    ],
  },
  {
    index: 2, key: 'signal', name: 'SIGNAL', mark: 'triangle',
    line: 'Your world reads from across the room, and you have spoken to the people in it.',
    requires: [
      { metric: 'world', target: 60 },
      { metric: 'follows', target: 8 },
      { metric: 'messages', target: 5 },
    ],
  },
  {
    /* 'diamond' is not a branch in Mark.jsx — it is that file's documented
       FALLBACK shape for any unknown type, and the house's default section
       mark. Named explicitly here so the intent survives a future refactor
       of Mark's switch. */
    index: 3, key: 'constellation', name: 'CONSTELLATION', mark: 'diamond',
    line: 'The bond runs both ways now, and there is work on your walls.',
    requires: [
      { metric: 'connections', target: 3 },
      { metric: 'posts', target: 1 },
      { metric: 'world', target: 90 },
    ],
  },
  {
    index: 4, key: 'fixed-star', name: 'FIXED STAR', mark: 'star',
    line: 'The room navigates by you. Not a rank — a habit, kept.',
    requires: [
      { metric: 'connections', target: 6 },
      { metric: 'posts', target: 6 },
      { metric: 'messages', target: 40 },
    ],
  },
]

/* The real bar for each rung = every requirement up to and including it,
   taking the HIGHEST target per metric. Computed once at module load.

   Why merge instead of trusting the table to be monotonic: if someone later
   lowers a target on a high rung, a naive "check only this rung's list"
   would hand out a level the person had not held at the rung below. The
   merge makes that class of edit harmless — the ladder can be re-tuned
   without anyone being granted anything by accident. */
const MERGED = TIERS.map((_, i) => {
  const acc = new Map()
  for (let k = 0; k <= i; k++) {
    for (const r of TIERS[k].requires) {
      acc.set(r.metric, Math.max(acc.get(r.metric) ?? 0, r.target))
    }
  }
  return METRIC_ORDER.filter((m) => acc.has(m)).map((m) => ({ metric: m, target: acc.get(m) }))
})

export const mergedRequirements = (index) => MERGED[index] || []

/* One-line summary of what a rung costs — "1 craft · world 25% · 3 followed".
   Lives here so the sheet, the identity card and anything later all write it
   identically; three hand-rolled versions of this line is exactly how Chip.jsx
   ended up existing. */
export function requirementLine(index) {
  const reqs = mergedRequirements(index)
  if (!reqs.length) return 'nothing required — you are already here'
  return reqs.map((r) => METRICS[r.metric].short(r.target)).join(' · ')
}

/* What a rung ADDS over the one below it. The merged bar is the truth but it
   is not readable at a glance: by rung 4 it is six clauses long.

   ⚠ WHICH LINE A ROW WEARS IS NOT A STYLE CHOICE — read StatusSheet's
   LadderRow before reusing this. A row you have already passed, or the one
   you are standing on, can wear the SHORT line: it makes no promise about
   what would open anything. A LOCKED row cannot — the lock beside it says
   "the line below is the whole bar that opens it", and stepLine(4) ("40
   messages · 6 connections · 6 on your walls") does not open FIXED STAR. The
   full
   merged bar is, and meets() in computeStatus tests exactly that. A locked
   row therefore wears requirementLine(), however long it runs. */
export function stepLine(index) {
  const tier = TIERS[index]
  if (!tier || !tier.requires.length) return 'nothing required — you are already here'
  const by = new Map(tier.requires.map((r) => [r.metric, r.target]))
  return METRIC_ORDER.filter((m) => by.has(m)).map((m) => METRICS[m].short(by.get(m))).join(' · ')
}

/* format a metric's value for display (one metric is a %, the rest are counts) */
export const metricValue = (key, n) => (n == null ? '—' : (METRICS[key]?.format?.(n) ?? `${n}`))

/* ── THE PURE MAPPER ──────────────────────────────────────────────────────
   counts → the verdict. NO I/O, NO clock, NO globals. Give it an object of
   numbers and it will always answer the same thing, which is the only way a
   thing that tells people who they are can be reviewed.

   `null` for a metric means UNKNOWN (the read failed), not zero — the crafts
   / tastes discipline the rest of this app already keeps. An unknown metric
   can never satisfy a requirement, so the verdict it produces would be too
   LOW rather than too high. That is still wrong, which is why fetchMyStatus
   refuses to compute at all when anything is unreadable; the handling here
   is the belt under those braces.

   Returns:
     { tier, tierIndex, nextTier, progress, requirements[], ladder[], complete } */
export function computeStatus(counts = {}) {
  const has = (metric, target) => {
    const v = counts[metric]
    return typeof v === 'number' && v >= target
  }
  const meets = (index) => mergedRequirements(index).every((r) => has(r.metric, r.target))

  // highest rung whose FULL merged bar is cleared. Rung 0 has an empty bar,
  // so `every` is vacuously true and everyone lands there at minimum — the
  // floor is a real rung, never a failure state.
  let tierIndex = 0
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (meets(i)) { tierIndex = i; break }
  }

  const tier = TIERS[tierIndex]
  const nextTier = TIERS[tierIndex + 1] || null

  // the breakdown shown to the person: the bar for the NEXT rung, or — at
  // the top — the bar they are currently holding, so the screen still
  // explains itself instead of going blank on the best outcome.
  const shown = mergedRequirements(nextTier ? nextTier.index : tierIndex)
  const requirements = shown.map((r) => {
    const raw = counts[r.metric]
    const unknown = typeof raw !== 'number'
    const current = unknown ? null : raw
    const ratio = r.target <= 0 ? 1 : Math.max(0, Math.min(1, (current ?? 0) / r.target))
    return {
      key: r.metric,
      label: METRICS[r.metric].label,
      hint: METRICS[r.metric].hint,
      current,
      target: r.target,
      met: !unknown && current >= r.target,
      unknown,
      ratio,
    }
  })

  /* Progress = the mean of each requirement's clamped ratio. Deliberately
     an average of the REAL rows and nothing else — no decay, no bonus, no
     weighting that would make the bar move without the numbers moving. It
     is always rendered directly above the rows it is made of, so anyone can
     check it by hand. At the top of the ladder there is nothing to progress
     toward, so it reads 1. */
  const progress = !nextTier
    ? 1
    : (requirements.length
      ? requirements.reduce((s, r) => s + r.ratio, 0) / requirements.length
      : 1)

  const ladder = TIERS.map((t) => ({
    ...t,
    state: t.index < tierIndex ? 'passed' : t.index === tierIndex ? 'current' : 'locked',
    summary: stepLine(t.index),        // what this rung ADDS — glanceable, safe on a row you hold or passed
    fullBar: requirementLine(t.index),  // the whole merged bar — what a LOCKED row must print (see stepLine)
  }))

  return { tier, tierIndex, nextTier, progress, requirements, ladder, complete: !nextTier }
}

/* =========================================================================
   THE READS. Everything below touches the network; nothing below decides
   anything. Each metric resolves to a NUMBER or to `null` (could not read).

   Cap notes: the follows edge read is capped and the id lookup is chunked,
   both far above anything on this platform (the busiest real member follows
   6 people). If either cap is ever hit the count UNDERSTATES rather than
   inventing — the safe direction. */

const EDGE_CAP = 1000     // follow edges pulled before we stop counting
const IN_CHUNK = 150      // ids per `.in()` — keeps the URL inside PostgREST's limits

/* head:true + count:'exact' counts POST-RLS rows and moves no body. For
   own-scoped tables (my crafts, my messages, my posts) that is already the
   honest number: the rows are structurally mine and nobody else's can enter
   the count. */
async function headCount(build) {
  try {
    const { count, error } = await build()
    if (error) return null
    /* `count` is only a number when PostgREST actually sent a Content-Range.
       If that header is missing or stripped by something in the middle,
       `count || 0` would hand back a zero that looks exactly like an honest
       zero for a read that never landed. Unknown stays unknown. */
    return typeof count === 'number' ? count : null
  } catch { return null }
}

/* How many of these profiles are REAL? The demo floor, applied client-side
   on purpose: RLS already hides seed from an ordinary member, but
   `is_owner()` opens it for the two founders (0033/0034), and their ladder
   has to read like everyone else's. Belt and braces, and the braces are the
   ones that matter here. */
async function countRealProfiles(ids) {
  let total = 0
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { head: true, count: 'exact' })
        .in('id', ids.slice(i, i + IN_CHUNK))
        .eq('is_demo', false)
        .is('deleted_at', null)
      if (error) return null
      total += count || 0
    } catch { return null }
  }
  return total
}

/* FOLLOWS I MADE, to real people. Two steps and not an embed: `follows` has
   two FKs to `profiles`, so a bare embed raises PGRST201 and a disambiguated
   one (`profiles!follows_followee_id_fkey!inner`) breaks the whole query the
   day someone renames a constraint. social.js chose the two-step for the same
   reason; this follows it.

   The seed scripts happen to never point a demo follow at a founder — but
   that is a COMMENT IN A SQL FILE, not a predicate. The predicate lives in
   countRealProfiles. */
async function realFollows(me) {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', me)
      .limit(EDGE_CAP)
    if (error) return null
    const ids = [...new Set((data || []).map((e) => e.followee_id).filter(Boolean))]
    if (!ids.length) return 0
    return await countRealProfiles(ids)
  } catch { return null }
}

/* CONNECTIONS ACCEPTED, with real people. my_circle() carries is_demo on
   every identity since 0044, so the floor is one filter and no second read.

   Called raw instead of through social.js's myCircle(): that helper returns
   an empty shape on failure, which is right for a list ("nobody yet") and
   wrong for a level (a network blip would silently demote a person). Here a
   failure must stay distinguishable from an honest zero. */
async function realConnections() {
  try {
    const { data, error } = await supabase.rpc('my_circle')
    if (error || !data?.ok) return null
    return (data.friends || []).filter((p) => !p.is_demo).length
  } catch { return null }
}

/* HOW BUILT THE WORLD IS. Reuses worldCompleteness (world.js) rather than
   re-deriving a second definition of "a built world" — two scores that
   disagree is worse than no score. Own row, always readable under RLS 0033
   even while purged, so this one cannot be inflated by anything. */
async function worldPct(me) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('discipline,tagline,gallery,world_links,marquee_text,world_theme,avatar_url,is_demo')
      .eq('id', me)
      .maybeSingle()
    if (error) return null
    // no row yet = the profile is born lazily on the first /profile visit.
    // That is an honest 0, not a failed read.
    return worldCompleteness(data || null).pct
  } catch { return null }
}

/* ── METRICS THAT EXIST BUT CANNOT BE READ FROM A BROWSER ─────────────────
   DAYS ACTIVE is real: `retention_activity` has one row per profile per UTC
   day (log_return, 0028) and the most active member genuinely has 6. But
   the table is RLS-on with ZERO policies and no grants — deny-all through
   PostgREST. There is no client read path, at all.

   So it is not in the ladder, and it does not render a 0. Rendering "0 days
   active" for someone who has been here six days would be a LIE — the exact
   opposite failure from fake fullness, and just as dishonest. The screen
   says what is missing and why, in the Settings grammar: a thing that does
   not work is labelled, never faked, never quietly dropped either.

   TODO (migration 0049, owned by the migration agent): add
     my_days_active() → jsonb {ok, days, first_day, last_day}
     security definer, stable, grant execute to authenticated,
     `select count(distinct day) from retention_activity where profile_id = auth.uid()`
   then move 'daysActive' out of PENDING_METRICS, read it in fetchMyCounts,
   and it becomes eligible as a requirement. Note when you do: the day
   boundary is UTC, not Houston, and log_return fires once per Layout mount
   — so it counts DAYS THE APP WAS OPENED, not days something was done.
   Label it accordingly or it becomes a different kind of lie.

   The COPY below is member-facing and stays that way: `retention_activity`,
   `my_days_active()` and a migration number are true and they are written
   above, in the code, where the person who has to build it will read them.
   Settings names a missing TABLE in a hint when that is the clearest way to
   say "this does not exist" — it has never quoted a migration number at a
   member, and neither does this. */
export const PENDING_METRICS = [
  {
    key: 'daysActive',
    label: 'Days active',
    why: 'the days you open this are recorded, but nothing can read them back to you yet',
    needs: 'a server-side read that does not exist',
  },
]

/* ── THE ONE FETCH ────────────────────────────────────────────────────────
   OWN RECORD ONLY. `profileId` must be the signed-in user's own id, and the
   session is checked before anything else — not paranoia: `my_circle()`
   always answers for the CALLER regardless of what id you pass, so a sheet
   wired to somebody else's id would blend two people's records into one
   level and look completely normal doing it. Better to render nothing.

   Returns { ok, counts, unreadable[] }. `ok` is false if ANY ladder metric
   failed to read, and the caller must then refuse to show a rung. A tier
   computed from a partial read is not "approximately right", it is a
   different person's number.

   TWO DIFFERENT FAILURES, TWO DIFFERENT WORDS — 'identity' vs 'session':
     · 'identity' = we READ the session and it is not this person (nobody
       signed in, or somebody else). Answer: sign in.
     · 'session'  = we could not read it AT ALL. auth-js returns
       { session: null, error } whenever the access token is past its
       refresh margin and the refresh request itself fails — a backgrounded
       phone, a flaky network, an auth 5xx. That is "we couldn't tell", not
       "you are not you".
   Caught in review: collapsing the second into the first told a genuinely
   signed-in member to sign in again. Absence of an answer is not an answer,
   which is the same rule AuthContext's three-way loading state exists for. */
export async function fetchMyCounts(profileId) {
  const blank = { crafts: null, world: null, follows: null, messages: null, connections: null, posts: null, daysActive: null }
  if (!profileId) return { ok: false, counts: blank, unreadable: ['identity'] }

  try {
    const { data: sess, error } = await supabase.auth.getSession()
    if (error) return { ok: false, counts: blank, unreadable: ['session'] }
    const uid = sess?.session?.user?.id
    if (!uid || uid !== profileId) return { ok: false, counts: blank, unreadable: ['identity'] }
  } catch {
    // a throw is the same class of event as `error`: unread, not answered.
    return { ok: false, counts: blank, unreadable: ['session'] }
  }

  const [crafts, world, follows, messages, connections, posts] = await Promise.all([
    headCount(() => supabase.from('profile_crafts').select('craft_id', { head: true, count: 'exact' }).eq('profile_id', profileId)),
    worldPct(profileId),
    realFollows(profileId),
    /* Messages I sent. RLS admits a thread's members, and you are always a
       member of a thread you sent into, so this is exactly my own rows. No
       migration ever inserts thread_messages, so there is no seed here to
       floor.
       KNOWN GAP, written down rather than hidden: request_friend/start_dm
       let a FOUNDER open a room with a seed profile (0023), so a founder's
       own messages into such a room would count. Excluding them needs a
       thread_members → profiles walk, i.e. a definer RPC. Today no founder
       has done it; if that changes this number needs the server.

       SECOND GAP, same posture: the RLS policy is membership-scoped, so
       LEAVING a crew retroactively lowers this count. The file's third law
       says a level can go down and that is correct — but it goes down here
       for "you left the room", not for "you undid the thing", which is a
       slightly different promise than the law makes. Reading messages you
       no longer have access to would need the server too. */
    headCount(() => supabase.from('thread_messages').select('id', { head: true, count: 'exact' }).eq('sender_id', profileId)),
    realConnections(),
    /* Pieces on your walls. Own rows only, structurally un-inflatable — and
       0 for every real member on the platform right now. It is never hidden:
       it stands in the ladder's bars at 0, and the moment it enters the bar
       you are working toward it gets its own row with the action that feeds
       it. Dropping the metric to make the screen look fuller is the exact
       dishonesty this file exists to prevent. */
    headCount(() => supabase.from('world_posts').select('id', { head: true, count: 'exact' }).eq('profile_id', profileId)),
  ])

  const counts = { crafts, world, follows, messages, connections, posts, daysActive: null }
  const unreadable = METRIC_ORDER.filter((k) => typeof counts[k] !== 'number')
  return { ok: unreadable.length === 0, counts, unreadable }
}

/* fetch + verdict, one call — what every surface should use.
   `status` is null when the read was incomplete, on purpose: no rung is
   better than a wrong rung. Surfaces render the honest "couldn't read your
   record" state and offer a retry. */
export async function fetchMyStatus(profileId) {
  const { ok, counts, unreadable } = await fetchMyCounts(profileId)
  return { ok, counts, unreadable, status: ok ? computeStatus(counts) : null }
}

/* The one-word answer, for surfaces that only have room for the name (the
   identity card). Returns null rather than a placeholder rung — an unknown
   status must render as absence, never as ARRIVED, or a read failure would
   quietly demote everyone who looked at it. */
export const tierNameOf = (record) => record?.status?.tier?.name || null
