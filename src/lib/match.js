import { supabase } from '@/api/supabase'

/* =========================================================================
   match — the interconnection column (D2) + the event's character (Ley 14).

   VIBES: the temperatures an event can declare (0021: events.vibe). Same
   locked cosmos palette — bone is the ONLY warmth, starlight is the
   electricity, silver is the instrument — what changes is the LIGHT:
   Live Art glows warm and pulses slow; Sound runs cold and electric;
   Gallery holds a sober golden-bone stillness. Color with meaning, never
   decoration.

   resolveLineupWorlds: lineup names become LIVE DOORS to their worlds —
   but only when the person actually exists on the platform (matched by
   handle or name). No match, no invented link (Ley 11).
   ========================================================================= */

export const VIBES = {
  'live-art': { label: 'Live Art', mark: '●', tint: '242,238,230', pulse: 'warm',     line: 'paint moving while the music plays' },
  'sound':    { label: 'Sound',    mark: '✕', tint: '232,233,237', pulse: 'electric', line: 'the booth leads the night' },
  'gallery':  { label: 'Gallery',  mark: '◇', tint: '242,238,230', pulse: 'none',     line: 'the work on walls, lights low' },
  'day':      { label: 'Day',      mark: '○', tint: '232,233,237', pulse: 'none',     line: 'open light, open doors' },
  'mixed':    { label: 'Mixed',    mark: '△', tint: '199,201,209', pulse: 'warm',     line: 'many rooms in one night' },
}
export const VIBE_KINDS = Object.keys(VIBES)
export const vibeMeta = (kind) => VIBES[kind] || null

/* normalize an events.vibe jsonb — absent/malformed reads as undeclared */
export function normVibe(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const kind = VIBE_KINDS.includes(v.kind) ? v.kind : null
  const sound = Array.isArray(v.sound) ? v.sound.filter((s) => typeof s === 'string' && s.trim()).slice(0, 6) : []
  const line = typeof v.line === 'string' && v.line.trim() ? v.line.trim() : ''
  if (!kind && !sound.length && !line) return null
  return { kind, sound, line }
}

/* The EXPERIENCE catalog's temperature (D3): a legacy experiences[] entry
   never declared a kind, so its own words decide — live paint reads warm,
   sound reads electric, gallery reads sober. Fallback: instrument silver. */
export function experienceTemp(exp) {
  const t = `${exp?.slug || ''} ${exp?.label || ''}`.toLowerCase()
  if (/(live|paint|mural|canvas|perform)/.test(t)) return { ...VIBES['live-art'], kind: 'live-art' }
  if (/(sound|music|dj|set|techno|house|booth|sonido)/.test(t)) return { ...VIBES['sound'], kind: 'sound' }
  if (/(galler|art|exhibit|archive|galer)/.test(t)) return { ...VIBES['gallery'], kind: 'gallery' }
  return { label: exp?.label || '', mark: '△', tint: '199,201,209', pulse: 'none', kind: null }
}

/* accent+case fold, mirror of the DB's c4_norm (0020) */
export const foldText = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().trim()

/* ---- lineup → worlds ----
   Returns Map(lineupIndex → { id, username, full_name, avatar_url }).
   Matching is deliberately conservative: a handle equal to the entry's
   slug (with/without dashes), or a full name that folds equal — and ONLY
   against VERIFIED members. Names and handles are self-serve; without the
   verified gate anyone could rename themselves after a headliner and wear
   the lineup's door on a live event page (review catch, HIGH). */
export async function resolveLineupWorlds(lineup = []) {
  const out = new Map()
  const entries = lineup
    .map((a, i) => ({ i, name: (a?.name || '').trim(), slug: (a?.slug || '').trim().toLowerCase() }))
    .filter((e) => e.name || e.slug)
  if (!entries.length) return out
  try {
    // one bounded query: candidate handles + candidate names (PostgREST
    // or-syntax; values with ()," or commas can't ride it — skip those)
    const clean = (s) => /^[^,()"]*$/.test(s)
    const handles = new Set()
    entries.forEach((e) => {
      if (e.slug && clean(e.slug)) { handles.add(e.slug); handles.add(e.slug.replace(/-/g, '')) }
    })
    const names = entries.map((e) => e.name).filter((n) => n && clean(n))
    const ors = [
      ...[...handles].map((h) => `username.ilike.${h}`),
      ...names.map((n) => `full_name.ilike.${n}`),
    ]
    if (!ors.length) return out
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, is_demo, verified')
      .or(ors.join(','))
      .eq('is_demo', false)
      .eq('verified', true)
      .limit(40)
    if (error || !data?.length) return out
    entries.forEach((e) => {
      const hit = data.find((p) => {
        const u = (p.username || '').toLowerCase()
        if (e.slug && (u === e.slug || u === e.slug.replace(/-/g, ''))) return true
        return e.name && foldText(p.full_name) === foldText(e.name)
      })
      if (hit) out.set(e.i, hit)
    })
    return out
  } catch { return out }
}
