import { supabase } from '@/api/supabase'

/* =========================================================================
   worldStorage — uploads for a member's world, on Supabase Storage.
   Bucket 'worlds' (migration 0014): public read; writes only under the
   caller's OWN uid folder (storage RLS — the client path here must match
   the server rule or every upload rejects). Size/type limits are enforced
   by the bucket server-side; the checks below just fail fast with a human
   message instead of a storage error.

   Replaces the base64-in-DB pattern (Profile.jsx pre-0014). Old data:image
   values keep rendering through safeImg — nothing is migrated in place.
   ========================================================================= */

export const WORLDS_BUCKET = 'worlds'
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // mirror of the bucket's file_size_limit
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }

export function validateImage(file) {
  if (!file) return 'No file.'
  if (!ALLOWED.includes(file.type)) return 'Use a JPG, PNG, WebP, GIF or AVIF image.'
  if (file.size > MAX_IMAGE_BYTES) return 'Max 8 MB per image.'
  return null
}

/* Upload one image into the caller's own folder. Returns { path, url }.
   Timestamped names: replacing never serves a stale CDN copy of the old
   object, and concurrent uploads never collide. */
export async function uploadWorldImage(userId, file, prefix = 'g') {
  const bad = validateImage(file)
  if (bad) throw new Error(bad)
  const path = `${userId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${EXT[file.type]}`
  const { error } = await supabase.storage.from(WORLDS_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from(WORLDS_BUCKET).getPublicUrl(path)
  return { path, url: data.publicUrl }
}

/* Best-effort delete — a failed cleanup must never break the flow that
   triggered it (the DB row is the source of truth for what renders). */
export async function removeWorldImages(paths) {
  const list = (Array.isArray(paths) ? paths : [paths]).filter(Boolean)
  if (!list.length) return
  try { await supabase.storage.from(WORLDS_BUCKET).remove(list) } catch { /* orphan, harmless */ }
}

/* If a stored URL points into the worlds bucket, recover its object path
   (for cleanup when an avatar/cover is replaced). Foreign/base64 URLs → null. */
export function worldPathFromUrl(url) {
  const m = /\/storage\/v1\/object\/public\/worlds\/(.+?)(?:[?#]|$)/.exec(url || '')
  return m ? decodeURIComponent(m[1]) : null
}
