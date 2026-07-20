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
   handle, slug, or name). No match, no invented link (Ley 11). v7 (D1):
   the entry's own `handle` (the IG @, e.g. 'patoduranc') is now the primary
   key — it equals the username, where the display slug ('pato-duran') does
   not. This is what makes PATO's real world open from the RBA lineup instead
   of the dead /artist page. Purged worlds never resolve (profiles_public_read
   RLS filters deleted_at, 0027 — no client filter needed).
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

   DOS CAMINOS, EN ESTE ORDEN:

   (1) `profile_id` EXPLÍCITO en el entry del lineup. Es la vía buena y gana
       sobre todo lo demás. La puso un fundador en una migración, así que no
       hay nada que adivinar ni superficie que suplantar.
   (2) Cotejo por texto (handle / slug / nombre plegado), sólo para los
       entries que NO traen id. Deliberadamente conservador y SÓLO contra
       miembros VERIFICADOS: los nombres y handles son de autoservicio, y
       sin esa reja cualquiera podría renombrarse como el headliner y
       quedarse con su puerta en un evento en vivo (review catch, HIGH).

   POR QUÉ HIZO FALTA (1) — el caso Madou: el entry dice handle "madou",
   name "MADOU", ig "@natemadou"; el perfil real dice full_name "Nate" y
   username NULL. CERO identificadores en común. Ningún cotejo por texto,
   por listo que sea, puede unirlos — y un mapa de alias "madou"→uuid metido
   en este archivo sería identidad de una persona escrita a mano dentro de
   lógica compartida: no escala, exige deploy por artista, y se pudre en
   cuanto alguien se cambia el nombre. El id vive con el dato.

   Sobre la reja en (1): un id explícito NO exige `verified`, porque no hay
   autoservicio que cerrar — lo escribió un fundador. Pero SÍ conserva el
   piso de integridad (is_demo=false, deleted_at null): un mundo semilla o
   purgado no se enlaza en público ni aunque alguien lo apunte a mano. */
export async function resolveLineupWorlds(lineup = []) {
  const out = new Map()
  const entries = lineup
    .map((a, i) => ({
      i,
      profileId: typeof a?.profile_id === 'string' ? a.profile_id.trim() : '',
      name: (a?.name || '').trim(),
      slug: (a?.slug || '').trim().toLowerCase(),
      handle: (a?.handle || '').replace(/^@/, '').trim().toLowerCase(),
    }))
    .filter((e) => e.profileId || e.name || e.slug || e.handle)
  if (!entries.length) return out
  try {
    // (1) los ids explícitos, de una
    const ids = [...new Set(entries.map((e) => e.profileId).filter(Boolean))]
    if (ids.length) {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, is_demo, verified')
        .in('id', ids)
        .eq('is_demo', false)
        .is('deleted_at', null)
      const byId = Object.fromEntries((data || []).map((p) => [p.id, p]))
      entries.forEach((e) => { if (e.profileId && byId[e.profileId]) out.set(e.i, byId[e.profileId]) })
    }
    // (2) el cotejo por texto, sólo para lo que quedó sin resolver
    const pending = entries.filter((e) => !out.has(e.i))
    if (!pending.length) return out
    return await resolveByText(pending, out)
  } catch { return out }
}

/* el camino (2), aparte para que el (1) se lea de un vistazo */
async function resolveByText(entries, out) {
  try {
    // one bounded query: candidate handles + candidate names (PostgREST
    // or-syntax; values with ()," or commas can't ride it — skip those)
    const clean = (s) => /^[^,()"]*$/.test(s)
    const handles = new Set()
    entries.forEach((e) => {
      if (e.handle && clean(e.handle)) handles.add(e.handle)   // the IG @ == the username (primary key)
      if (e.slug && clean(e.slug)) { handles.add(e.slug); handles.add(e.slug.replace(/-/g, '')) }
    })
    /* EL NOMBRE ACENTUADO NUNCA RESOLVÍA (encontrado en v12, verificando
       ExperienceDetail: "Pato Durán" salía como texto muerto teniendo un
       perfil verificado detrás).

       El cotejo del cliente usa foldText, que quita acentos — o sea la
       intención SIEMPRE fue ser insensible a acentos. Pero la consulta
       mandaba el nombre crudo a `full_name.ilike.Pato Durán`, e ilike en
       Postgres es insensible a MAYÚSCULAS, no a ACENTOS: un perfil guardado
       como "Pato Duran" jamás regresaba, así que el fold del cliente nunca
       llegaba a tener candidato que comparar. El acento se comía la puerta
       en silencio.

       Se manda también la variante sin acentos. NO afloja nada: el filtro
       verificado + no-demo sigue igual, y la precedencia estricta del
       cliente (handle > slug > nombre) tampoco se toca — esto sólo deja que
       la DB devuelva al candidato que el cliente ya pensaba cotejar.

       Importa más de lo que parece: esto también corre en el lineup de un
       evento en vivo, y en una comunidad latina los acentos son la norma,
       no el caso raro. */
    const names = []
    entries.forEach((e) => {
      if (!e.name || !clean(e.name)) return
      names.push(e.name)
      const folded = foldText(e.name)
      if (folded && folded !== e.name.toLowerCase() && clean(folded)) names.push(folded)
    })
    const ors = [
      ...[...handles].map((h) => `username.ilike.${h}`),
      ...[...new Set(names)].map((n) => `full_name.ilike.${n}`),
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
      // strict precedence handle > slug > name: the handle IS the username,
      // so a precise handle match must never lose to a weaker name-fold match
      // that happens to sort first in the unordered result.
      const byHandle = e.handle ? data.find((p) => (p.username || '').toLowerCase() === e.handle) : null
      const bySlug = !byHandle && e.slug ? data.find((p) => { const u = (p.username || '').toLowerCase(); return u === e.slug || u === e.slug.replace(/-/g, '') }) : null
      const byName = !byHandle && !bySlug && e.name ? data.find((p) => foldText(p.full_name) === foldText(e.name)) : null
      const hit = byHandle || bySlug || byName
      if (hit) out.set(e.i, hit)
    })
    return out
  } catch { return out }
}
