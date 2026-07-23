import { supabase } from '@/api/supabase'

/* =========================================================================
   forYou — the FOR YOU feed's client contract (D2 · migration 0022).

   get_for_you() ranks people and events by taste + crafts + follows +
   event character — and the PRIVACY LAW rides every line of copy here:
   ranking may use private taste invisibly, but the ONLY overlaps the UI
   may NAME are shared_crafts, shared_public_tastes, shared_sounds and
   city. Nothing raw survives into words. When someone ranks high with
   zero nameable reasons, the honest line is a quiet one — "the universe
   sees a match" — and nothing more specific, ever.
   ========================================================================= */

/* rpc wrapper → { city, people, events } — or null on error / signed out.
   The RPC answers {ok:false} for anon; null lets the surface render its
   honest door instead of a crash (Ley 11). */
export async function fetchForYou({ limit = 30, city = null } = {}) {
  try {
    const { data, error } = await supabase.rpc('get_for_you', { p_limit: limit, p_city: city })
    if (error || !data?.ok) return null
    return {
      city: data.city || '',
      people: Array.isArray(data.people) ? data.people : [],
      events: Array.isArray(data.events) ? data.events : [],
    }
  } catch { return null }
}

/* naive plural for a craft worn by two people ("both djs") — names ending
   in s keep their shape */
const plural = (s) => (/s$/.test(s) ? s : `${s}s`)

/* the SPEAKABLE reasons, priority-ordered, max 3 — short mono lines.
   Composed ONLY from data the other person made public: shared crafts,
   shared PUBLIC tastes, city, the public follow edge. */
export function reasonsFor(person = {}) {
  const out = []
  const crafts = (Array.isArray(person.shared_crafts) ? person.shared_crafts : [])
    .filter(Boolean).map((n) => String(n).toLowerCase())
  if (crafts[0]) out.push(`both ${plural(crafts[0])}`)
  if (crafts[1]) out.push(`also a ${crafts[1]}`)
  const tastes = (Array.isArray(person.shared_public_tastes) ? person.shared_public_tastes : [])
    .map((t) => (t?.label || '').trim().toLowerCase()).filter(Boolean)
  if (tastes.length) out.push(`shares ${tastes.slice(0, 2).join(' · ')}`)
  if (person.same_city && person.city) out.push(`in ${String(person.city).toLowerCase()}`)
  if (person.follows_me) out.push('follows your world')
  /* v16 (0054): el score ya no excluye a nadie — un perfil sin señales
     compartidas AHORA APARECE, y decirle "the universe sees a match" sería
     mentira. La línea callada dice la verdad: están en el mismo universo,
     todavía sin señal compartida. Integridad §4: el copy nunca promete lo
     que el sistema no hizo. */
  if (!out.length) return ['no shared signals yet']
  return out.slice(0, 3)
}

/* same idea for a room — event sounds are public declarations, naming
   them is honest. No reasons → no line (an event never wears the
   universe's quiet sentence; that one belongs to people). */
export function eventReasonsFor(evt = {}) {
  const out = []
  const sounds = (Array.isArray(evt.shared_sounds) ? evt.shared_sounds : [])
    .filter(Boolean).map((s) => String(s).toLowerCase())
  if (sounds.length) out.push(`speaks ${sounds[0]} — your sound`)
  if (evt.host_followed) out.push('from your orbit')
  if (evt.same_city) out.push('in your city')
  if (evt.is_house) out.push("the house's room")
  return out.slice(0, 3)
}
