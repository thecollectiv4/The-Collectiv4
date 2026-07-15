import { supabase } from '@/api/supabase'

/* =========================================================================
   tastes — the quiet layer's client vocabulary (migration 0022).
   One source of truth for the brainstorm (TasteBrainstorm), the builder's
   taste step, and (D2) the for-you column.

   THE CONTRACT (0022, LIVE on the remote):
     search_taste_bank(p_query, p_domain) → [{ domain, items:[{id,label,slug}] }]
                                            (anon-ok; no query = whole bank,
                                            grouped music → film → interest)
     profile_tastes                       → RLS: owner reads ALL own rows;
                                            anyone else reads ONLY is_public
     set_profile_tastes(p)                → ATOMIC whole-set replace, the
                                            single write door (forge-proof)

   PRIVACY IS THE PRODUCT: is_public defaults false. Private items feed
   matching invisibly and never display — the raw ranks, only the public
   speaks. fetchMyTastes returns NULL on error (not []) on purpose: a save
   from a null-seeded set would ERASE a member's tastes, so loading/error
   must stay distinguishable from honestly-empty (the crafts discipline).
   ========================================================================= */

/* The three domains — each with its Mark glyph + a mono kicker. Keys are
   the DB's own check constraint ('music' | 'film' | 'interest'); ALIVE is
   the interest domain's door sign, not its key. */
export const TASTE_DOMAINS = [
  { key: 'music', label: 'MUSIC', mark: 'ring', kicker: 'what moves the room' },
  { key: 'film', label: 'FILM', mark: 'triangle', kicker: 'what moves you quietly' },
  { key: 'interest', label: 'ALIVE', mark: 'star', kicker: 'what you do when nobody books you' },
]
export const tasteDomainMeta = (key) => TASTE_DOMAINS.find((d) => d.key === key) || TASTE_DOMAINS[2]

/* ---- search: the brainstorm's live feed (anon-ok, grouped by domain) ---- */
export async function searchTasteBank(query, domain) {
  try {
    const { data, error } = await supabase.rpc('search_taste_bank', { p_query: query || null, p_domain: domain || null })
    if (error) return []
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

/* ---- read: the OWNER's whole set, raw (RLS admits only the owner) ----
   null = loading/error — never confuse it with an honestly-empty [] */
export async function fetchMyTastes(uid) {
  if (!uid) return null
  try {
    const { data, error } = await supabase
      .from('profile_tastes')
      .select('id,domain,label,is_public,position')
      .eq('profile_id', uid)
      .order('position')
    if (error) return null
    return data || []
  } catch { return null }
}

/* ---- read: what a profile chose to SHOW (RLS does the filtering) ----
   the world's display read (D2 uses it); empty and honest on error */
export async function fetchPublicTastes(profileId) {
  if (!profileId) return []
  try {
    const { data, error } = await supabase
      .from('profile_tastes')
      .select('id,domain,label,is_public,position')
      .eq('profile_id', profileId)
      .order('position')
    if (error) return []
    return data || []
  } catch { return [] }
}

/* ---- write: atomic whole-set replace (requires session) ----
   Order of the array = display position. Caps live server-side too
   (40/domain, 90 total, labels 1–48 chars). */
export async function saveTastes(items) {
  const p = (items || []).map((t) => ({ domain: t.domain, label: t.label, is_public: !!t.is_public }))
  const { data, error } = await supabase.rpc('set_profile_tastes', { p })
  if (error) throw new Error(error.message || "couldn't save your tastes")
  if (!data?.ok) throw new Error(data?.error === 'not_authenticated' ? 'sign in first.' : (data?.error || "couldn't save your tastes"))
  return data
}
