/* =========================================================================
   world.js — shared vocabulary of a member's WORLD (profile-museum).
   One source of truth for ProfileMuseum (the museum) and WorldBuilder
   (the guided build): normalizers, the welcome marquee, the skins, and
   the completeness math behind "your world is at 60%".
   ========================================================================= */

import { supabase } from '@/api/supabase'

const BONE = 'var(--cream)'
// display chrome — the deck's exact liquid formula (v8 D3): one chrome
// language across the whole universe, jewelry never paint
export const CHROME_DISPLAY = 'var(--chrome)'
export const chromeDisplayText = { background: CHROME_DISPLAY, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

export function worldSafeUrl(raw) { const u = (raw || '').trim(); return /^https?:\/\//i.test(u) ? u : '' }

export const normGallery = (g) => (Array.isArray(g) ? g.filter(x => x && worldSafeUrl(x.url)) : [])
export const normLinks = (l) => (Array.isArray(l) ? l.filter(x => x && worldSafeUrl(x.url)) : [])

// the welcome marquee (0014 marquee_text): null → the house default,
// empty string → the owner turned the ticker off.
export const DEFAULT_MARQUEE = 'wlcme 2 my wrld'
export const marqueeOf = (t) => (t === '' ? '' : ((t ?? '').trim() || DEFAULT_MARQUEE))

// world skins: composition presets INSIDE cosmos — the display-type
// treatment changes, the palette never does (no per-profile colors).
export const THEMES = [
  { key: 'chrome', label: 'Chrome' },
  { key: 'outline', label: 'Outline' },
  { key: 'bone', label: 'Bone' },
]
export function nameSkin(theme) {
  // outline: fill transparent + stroke. `filter: none` is load-bearing — a
  // drop-shadow filter over stroked transparent text can composite to
  // NOTHING in Chromium (the museum hero carries one for the chrome skin;
  // caught by the walkthrough: the anon world rendered a nameless hero).
  if (theme === 'outline') return { color: 'transparent', WebkitTextStroke: `1.5px ${BONE}`, filter: 'none' }
  if (theme === 'bone') return { color: BONE }
  return chromeDisplayText
}

/* Craft kinds — the builder reorganizes around what the person MAKES.
   A photographer leads with the wall; a DJ leads with the sound links; a
   writer gets a long-text piece. Not different flows in code — different
   ORDER, COPY and EMPHASIS over the same steps. Sound is tested before
   word before visual so "songwriter" reads as sound, "screenwriter" as word. */
export function craftKindOf(discipline) {
  const d = (discipline || '').toLowerCase()
  if (!d.trim()) return 'generic'
  if (/(dj|deejay|music|producer|sound|singer|songwriter|rapper|vocal|band|beat|composer|instrument|guitarr?|drummer|bassist|pianist|selector)/.test(d)) return 'sound'
  if (/(writ|poet|author|journal|essay|novel|storytell|copywr)/.test(d)) return 'word'
  if (/(photo|paint|design|film|video|visual|illustr|\bart\b|artist|tattoo|fashion|style|stylist|model|direct|creativ|graphic|archit|sculpt|cinemat|animat|ceramic|muralis|drawer)/.test(d)) return 'visual'
  return 'generic'
}

/* Step order per craft — same steps, different door. `words` (the writer's
   piece) edits `bio`, which the museum already opens the world with.
   `taste` (v6) rides right after the craft: who you are, then what you
   love — the quiet layer that powers the for-you (0022). */
export const CRAFT_STEPS = {
  visual: ['craft', 'taste', 'work', 'doors', 'marquee', 'skin'],
  sound: ['craft', 'taste', 'doors', 'work', 'marquee', 'skin'],
  word: ['craft', 'taste', 'words', 'work', 'doors', 'marquee', 'skin'],
  generic: ['craft', 'taste', 'work', 'doors', 'marquee', 'skin'],
}

/* =========================================================================
   Modular worlds (v6, 0024) — the museum's rooms as a vocabulary. The
   world ADAPTS to the primary craft: a DJ's leads with sound + upcoming
   sets, a photographer's with the gallery + the offer, a discoverer's
   with public taste + moments. profiles.world_modules holds the owner's
   own ordered composition; NULL means the kind-default below. Labels and
   kickers mirror the museum's Marker calls — one vocabulary, no drift.
   ========================================================================= */

export const MODULES = {
  gallery: { label: 'GALLERY', kicker: 'the work, on walls' },
  moments: { label: 'MOMENTS', kicker: 'the wall continues — dated' },
  offer: { label: 'THE OFFER', kicker: 'the wall, working · for sale' },
  sound: { label: 'SOUND', kicker: 'on rotation' },
  screen: { label: 'SCREEN', kicker: 'what i watch' },
  influences: { label: 'INFLUENCES', kicker: 'what shaped me' },
  work: { label: 'WORK', kicker: 'what i make' },
  taste: { label: 'TASTE', kicker: 'made public — the rest works in silence' },
  sets: { label: 'SETS', kicker: 'where it plays next' },
}

/* the stored column, defended: whitelist to known keys, dedupe, keep the
   owner's order. null/invalid/empty → null (the kind-default composes). */
export function normModules(v) {
  if (!Array.isArray(v)) return null
  const seen = new Set()
  const out = []
  v.forEach((k) => { if (typeof k === 'string' && MODULES[k] && !seen.has(k)) { seen.add(k); out.push(k) } })
  return out.length ? out : null
}

/* the kind-default composition — every room on, ordered by what leads
   that kind of world. 'generic'/null = the discoverer (no craft yet). */
const MODULE_DEFAULTS = {
  sound: ['sound', 'sets', 'gallery', 'moments', 'taste', 'offer', 'screen', 'influences', 'work'],
  visual: ['gallery', 'work', 'sets', 'moments', 'offer', 'taste', 'sound', 'screen', 'influences'],
  word: ['influences', 'work', 'gallery', 'moments', 'taste', 'offer', 'sound', 'screen', 'sets'],
  generic: ['taste', 'moments', 'gallery', 'sound', 'screen', 'influences', 'offer', 'work', 'sets'],
}
export function defaultModulesFor(kind) {
  return MODULE_DEFAULTS[kind] || MODULE_DEFAULTS.generic
}

/* ---- the SETS movement's read: upcoming published rooms this person
   hosts (public-read RLS; is_test excluded — honest walls only). The
   12h grace keeps tonight's room on the wall while it's still going. */
export async function fetchUpcomingSets(profileId) {
  if (!profileId) return []
  try {
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString()
    const { data, error } = await supabase
      .from('events')
      .select('id,slug,title,event_date,venue,city,cover_url,vibe')
      .eq('host_id', profileId)
      .eq('status', 'published')
      .eq('is_test', false)
      .gte('event_date', since)
      .order('event_date', { ascending: true })
      .limit(6)
    if (error) return []
    return data || []
  } catch { return [] }
}

/* =========================================================================
   Builder v3 — the conversational opening (Ley 15: the builder knows the
   person before asking for anything). Three answers — what you make, what
   entering your world should FEEL like, what you have ready today — become
   a composed PLAN: step order, emphasis, a suggested skin and a suggested
   welcome line. This is the client-side decision tree; /api/curate (when
   the key is live) polishes the suggestions on top. Degrades to exactly
   this when the endpoint is absent — curated either way, surveyed never.
   ========================================================================= */

/* feel → skin: the composition should MATCH what the person wants a
   visitor to feel (Ley 14 — light and color with meaning). */
export function skinForFeel(feel) {
  const f = (feel || '').toLowerCase()
  if (/(raw|dark|bold|loud|underground|grit|heavy|hard|edge|rebel|street)/.test(f)) return 'outline'
  if (/(warm|human|home|soft|close|cozy|intim|tender|family|safe|calm|peace)/.test(f)) return 'bone'
  return 'chrome' // timeless / elegant / luminous — the house default
}

/* The composed plan. `show` is what they said they have ready today:
   any of 'images' | 'links' | 'words'. The step that matches what they
   HAVE leads; what they don't have stays available but never leads.
   `kind` (v5): the chosen crafts' own category decides upstream (0020) —
   the free-text sniff only serves craft-less legacy worlds. */
export function composeWorldPlan({ craft, feel, show = [], kind: kindOverride }) {
  const kind = kindOverride || craftKindOf(craft)
  const has = new Set(show)

  // content steps, led by what's actually in their hands today
  const order = []
  const push = (k) => { if (!order.includes(k)) order.push(k) }
  if (has.has('words')) push('words')
  if (has.has('images')) push('work')
  if (has.has('links')) push('doors')
  // fill the rest in the craft's own order (minus 'craft' — already
  // answered — and 'taste', which rides right after the line below)
  CRAFT_STEPS[kind].forEach((k) => { if (k !== 'craft' && k !== 'taste' && k !== 'marquee' && k !== 'skin') push(k) })

  const skin = skinForFeel(feel)
  // local marquee suggestion: their own feel, spoken as a welcome — never
  // invented facts, just their words turned toward the door
  const feelLine = (feel || '').trim().replace(/[.!]+$/, '')
  const marquee = feelLine && feelLine.length <= 64 ? feelLine.toLowerCase() : ''

  return {
    kind,
    steps: ['line', 'taste', ...order, 'marquee', 'skin'],
    skin,
    marquee: marquee || null,   // null → keep the house default
    line: null,                 // a suggested tagline comes only from /api/curate
  }
}

/* Completeness — what "a built world" means, in points (sums to 100):
   craft 15 · your line 15 · 3 gallery pieces 30 (10 each) · a link 15 ·
   marquee decided 10 · skin chosen 10 · a face 5. Deliberately EXCLUDES
   taste/media/bio — those are curation, not the front door. */
export function worldCompleteness(d) {
  if (!d) return { pct: 0, missing: [] }
  const gallery = normGallery(d.gallery)
  const links = normLinks(d.world_links)
  let pts = 0
  const missing = []
  if ((d.discipline || '').trim()) pts += 15; else missing.push('craft')
  if ((d.tagline || '').trim()) pts += 15; else missing.push('line')
  pts += Math.min(3, gallery.length) * 10
  if (gallery.length < 3) missing.push('work')
  if (links.length) pts += 15; else missing.push('links')
  if (d.marquee_text != null) pts += 10; else missing.push('marquee')
  if (d.world_theme != null) pts += 10; else missing.push('skin')
  if ((d.avatar_url || '').trim()) pts += 5; else missing.push('face')
  return { pct: Math.min(100, pts), missing }
}
