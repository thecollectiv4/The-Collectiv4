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
   If the insert fails, the just-uploaded objects are cleaned up — a failed
   post never leaves orphans wearing the world's name. */
export async function createWorldPost(userId, { files = [], caption = '' }) {
  const images = []
  for (const f of files) {
    const { path, url } = await uploadWorldImage(userId, f, 'p')
    images.push({ path, url })
  }
  const { data, error } = await supabase
    .from('world_posts')
    .insert({ profile_id: userId, caption: caption.trim() || null, images })
    .select('id,profile_id,caption,images,created_at')
    .single()
  if (error) {
    removeWorldImages(images.map((i) => i.path))
    if (MISSING_TABLE.test(error.message || '')) {
      throw new Error('posting is almost live — the world_posts migration has not run yet')
    }
    throw new Error(error.message || "couldn't post")
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
