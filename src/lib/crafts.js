import { supabase } from '@/api/supabase'

/* =========================================================================
   crafts — the craft taxonomy's client vocabulary (migration 0020).
   One source of truth for the theatrical picker (CraftPicker), the museum
   hero, Community's craft filter, and the matching column (D2).

   THE CONTRACT (0020, verified live against the remote):
     search_crafts(p_query)        → [{ category, crafts:[{id,name,slug,aliases}] }]
                                     (anon-ok; no query = the whole taxonomy)
     profile_crafts + crafts embed → a person's many crafts, one is_primary
     set_profile_crafts(ids, id)   → atomic own-row replace, forge-proof

   profiles.discipline COEXISTS: after a craft save the summary line is
   derived from the chosen crafts (craftLine) so every legacy surface —
   filters, cards, craftKindOf — keeps reading something true.
   ========================================================================= */

/* The curated category order (mirrors 0020's ranking) with each category's
   temperature + mark — light and color with MEANING (Ley 14), inside the
   locked cosmos palette: bone (making/performing, the only warmth), silver
   (instrument/visual work), starlight (media/signal). */
export const CATEGORY_META = {
  'Music & Audio':          { mark: '●', tint: '242,238,230', kind: 'sound' },
  'Visual Arts':            { mark: '○', tint: '199,201,209', kind: 'visual' },
  'Design':                 { mark: '◇', tint: '199,201,209', kind: 'visual' },
  'Fashion':                { mark: '△', tint: '242,238,230', kind: 'visual' },
  'Photo & Video':          { mark: '✕', tint: '232,233,237', kind: 'visual' },
  'Events & Production':    { mark: '●', tint: '242,238,230', kind: 'generic' },
  'Content & Media':        { mark: '○', tint: '232,233,237', kind: 'generic' },
  'Written':                { mark: '◆', tint: '199,201,209', kind: 'word' },
  'Movement & Performance': { mark: '△', tint: '242,238,230', kind: 'generic' },
  'Culinary':               { mark: '◇', tint: '242,238,230', kind: 'generic' },
  'Tech Creative':          { mark: '✕', tint: '232,233,237', kind: 'generic' },
  'Business Creative':      { mark: '○', tint: '199,201,209', kind: 'generic' },
}
export const categoryMeta = (category) => CATEGORY_META[category] || { mark: '◇', tint: '199,201,209', kind: 'generic' }

/* ---- search: the picker's live feed (anon-ok, grouped by category) ---- */
export async function searchCrafts(query) {
  try {
    const { data, error } = await supabase.rpc('search_crafts', { p_query: query || null })
    if (error) return []
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

/* ---- read: one profile's crafts, primary first ---- */
export function normProfileCrafts(rows) {
  return (rows || [])
    .filter((r) => r && r.crafts)
    .map((r) => ({
      id: r.craft_id || r.crafts.id,
      name: r.crafts.name,
      slug: r.crafts.slug,
      category: r.crafts.category,
      isPrimary: !!r.is_primary,
    }))
}

export async function fetchProfileCrafts(profileId) {
  if (!profileId) return []
  try {
    const { data, error } = await supabase
      .from('profile_crafts')
      .select('craft_id, is_primary, position, crafts(id, name, slug, category)')
      .eq('profile_id', profileId)
      .order('is_primary', { ascending: false })
      .order('position')
    if (error) return []
    return normProfileCrafts(data)
  } catch { return [] }
}

/* ---- read: crafts for MANY profiles (Community cards + filter) ----
   → Map(profileId → [{id,name,slug,category,isPrimary}] primary first) */
export async function fetchCraftsForProfiles(profileIds = []) {
  const map = new Map()
  if (!profileIds.length) return map
  try {
    const { data, error } = await supabase
      .from('profile_crafts')
      .select('profile_id, craft_id, is_primary, position, crafts(id, name, slug, category)')
      .in('profile_id', profileIds)
      .order('is_primary', { ascending: false })
      .order('position')
    if (error) return map
    ;(data || []).forEach((r) => {
      if (!r?.crafts) return
      const list = map.get(r.profile_id) || []
      list.push({ id: r.craft_id || r.crafts.id, name: r.crafts.name, slug: r.crafts.slug, category: r.crafts.category, isPrimary: !!r.is_primary })
      map.set(r.profile_id, list)
    })
    return map
  } catch { return map }
}

/* ---- write: atomic own-set replace (requires session) ---- */
export async function saveProfileCrafts(craftIds, primaryId) {
  const { data, error } = await supabase.rpc('set_profile_crafts', {
    p_craft_ids: craftIds,
    p_primary_id: primaryId || null,
  })
  if (error) throw new Error(error.message || "couldn't save your crafts")
  if (!data?.ok) throw new Error(data?.error === 'not_authenticated' ? 'sign in first.' : (data?.error || "couldn't save your crafts"))
  return data
}

/* ---- the summary line: crafts → the discipline column's derived truth ----
   Primary leads; capped so chips and filters never eat a paragraph. */
export function craftLine(crafts = []) {
  if (!crafts.length) return ''
  const ordered = [...crafts].sort((a, b) => (b.isPrimary === true) - (a.isPrimary === true))
  const names = ordered.map((c) => c.name)
  let line = names[0]
  for (let i = 1; i < names.length; i++) {
    const next = `${line} · ${names[i]}`
    if (next.length > 56) { line = `${line} +${names.length - i}`; break }
    line = next
  }
  return line
}

/* ---- kind: what leads this person's world (the builder's composition) ----
   The craft's own category decides — no more regex over free text. Falls
   back to the legacy craftKindOf(discipline) upstream when crafts are empty. */
export function kindOfCrafts(crafts = []) {
  if (!crafts.length) return null
  const primary = crafts.find((c) => c.isPrimary) || crafts[0]
  return categoryMeta(primary.category).kind
}

/* ---- the recognition lines — the universe answers (Ley 15) ----
   Deterministic, curated per kind; never invented facts about the person. */
export const KIND_LINES = {
  sound: '● a sound world — your links will lead',
  visual: '○ a visual world — your wall leads',
  word: '◆ a written world — your piece comes next',
  generic: '◇ a maker’s world — your work leads',
}
export function recognitionLine(crafts = []) {
  if (!crafts.length) return ''
  const kinds = new Set(crafts.map((c) => categoryMeta(c.category).kind))
  const primary = crafts.find((c) => c.isPrimary) || crafts[0]
  if (kinds.size > 1) return `◆ a world of many rooms — ${primary.name.toLowerCase()} leads`
  return KIND_LINES[categoryMeta(primary.category).kind] || KIND_LINES.generic
}
