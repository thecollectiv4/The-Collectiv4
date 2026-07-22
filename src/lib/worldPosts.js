import { supabase } from '@/api/supabase'
import { uploadWorldImage, removeWorldImages } from '@/lib/worldStorage'

/* =========================================================================
   worldPosts — a post is a DATED piece in a member's world: image(s) + a
   caption (table world_posts, migration 0016). The gallery extended into a
   timeline of moments. Storage rides the 'worlds' bucket under the owner's
   own uid folder ('p-' prefix) — the same server-side RLS as the gallery.

   DEGRADES HONESTLY pre-migration: reads resolve to an empty list (the
   world simply has no moments yet); writes surface the real error so the
   composer can say what happened instead of pretending.
   ========================================================================= */

const MISSING_TABLE = /world_posts|schema cache|does not exist/i

export const normPosts = (rows) => (Array.isArray(rows) ? rows : [])
  .map((r) => ({ ...r, images: Array.isArray(r.images) ? r.images.filter((x) => x && x.url) : [] }))

/* Public + owner read: newest first. RLS mirrors the world's own visibility
   (a demo/QA world's posts never reach the public path). */
export async function fetchWorldPosts(profileId) {
  if (!profileId) return []
  const { data, error } = await supabase
    .from('world_posts')
    .select('id,profile_id,caption,images,created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) return []   // pre-0016 (or transient) → an empty timeline, never a crash
  return normPosts(data)
}

/* Upload each image into the caller's own folder, then insert the post row.
   A failure ANYWHERE (mid-upload or at insert) cleans up every object
   already uploaded — a failed post never leaves orphans in storage. */
export async function createWorldPost(userId, { files = [], caption = '' }) {
  const images = []
  try {
    for (const f of files) {
      const { path, url } = await uploadWorldImage(userId, f, 'p')
      images.push({ path, url })
    }
  } catch (e) {
    removeWorldImages(images.map((i) => i.path))
    throw e
  }
  const { data, error } = await supabase
    .from('world_posts')
    .insert({ profile_id: userId, caption: caption.trim() || null, images })
    .select('id,profile_id,caption,images,created_at')
    .single()
  if (error) {
    removeWorldImages(images.map((i) => i.path))
    if (MISSING_TABLE.test(error.message || '')) {
      // honest, in human words — no schema names at the member (Ley 5/10)
      throw new Error("posting isn't switched on yet — the platform update is on its way. your world is safe.")
    }
    throw new Error(error.message || "couldn't post")
  }
  return data
}

/* Owner edit — the LINE only. A hung piece doesn't get re-cut: images are
   immutable after publish; what the owner rewrites is the wall text. RLS
   (world_posts_owner_update, 0016) is the gate; `.single()` turns a
   zero-row update (not yours / gone) into an honest throw instead of a
   silent no-op.

   The one edit the DB would reject anyway gets blocked here with human
   words (Ley 5/10): world_posts_not_empty forbids a post with no images
   AND no caption, so clearing the line on a text-only moment is not
   "saving", it is deleting with extra steps — and delete already exists. */
export async function updateWorldPostCaption(post, caption) {
  const line = (caption || '').trim()
  const hasImages = Array.isArray(post.images) && post.images.length > 0
  if (!line && !hasImages) {
    throw new Error('a moment with no image needs its line — to take the piece down, use remove')
  }
  const { data, error } = await supabase
    .from('world_posts')
    .update({ caption: line || null })
    .eq('id', post.id)
    .select('id,profile_id,caption,images,created_at')
    .single()
  if (error) {
    /* CERO FILAS = LA PIEZA YA NO ESTÁ AHÍ (borrada en otra pestaña, en el
       teléfono, o nunca fue tuya y RLS la filtró). `.single()` lo convierte
       en un throw en vez de un no-op silencioso — eso es lo que queremos —
       pero el TEXTO de PostgREST ("JSON object requested, multiple (or no)
       rows returned") es voz de API, no de la casa: un miembro no tiene por
       qué leer eso (Ley 5/10, misma doctrina que authErrors.js). El delete
       nunca llega aquí: borrar una fila que ya no está sale bien y calla. */
    if (error.code === 'PGRST116' || /multiple \(or no\) rows|coerce the result/i.test(error.message || '')) {
      throw new Error("that moment isn't on your wall anymore — it may have been removed somewhere else")
    }
    throw new Error(error.message || "couldn't save the line")
  }
  return data
}

/* Owner delete: the row first (source of truth), storage best-effort after. */
export async function deleteWorldPost(post) {
  const { error } = await supabase.from('world_posts').delete().eq('id', post.id)
  if (error) throw new Error(error.message || "couldn't delete")
  removeWorldImages((post.images || []).map((i) => i.path).filter(Boolean))
}

export const postDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
  } catch { return '' }
}
