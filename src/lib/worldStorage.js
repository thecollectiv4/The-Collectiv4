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

/* v17 — EL DOWNSCALE EN SUBIDA (fase 7). Las portadas llegaban a 3024×4032
   (12MP, 3-6MB) y For You las decodificaba 4-8s sobre red real. Un canvas
   client-side las baja a ~1920px de lado largo ANTES de subir — cero infra
   nueva, independiente del plan de Supabase (render/image sigue 403 en
   este tenant, ver img.js).

   Alcance DELIBERADO: sólo avatar y cover lo llaman (Profile.jsx). El
   choke point de subida alimenta seis flujos — gallery, moments, listings
   y event covers NO se tocan en v17: la galería tiene un link "abrir
   original" que un downscale degradaría, y esa decisión es de fundador.

   Reglas duras:
   · gif/avif pasan intactos (canvas mata la animación y no encode avif)
   · png queda png (transparencia); jpeg/webp re-encodan jpeg q.85
   · el File devuelto carga el MIME correcto — EXT y contentType derivan
     de file.type y un blob renombrado subiría mentido (riesgo documentado)
   · createImageBitmap con from-image: la foto de iPhone en portrait llega
     con orientación EXIF y el canvas la hornea YA rotada
   · cualquier falla devuelve el original — esto es una optimización,
     nunca una pared. */
export async function downscaleImage(file, maxEdge = 1920, quality = 0.85) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      .catch(() => createImageBitmap(file))
    const scale = maxEdge / Math.max(bmp.width, bmp.height)
    if (scale >= 1) { bmp.close?.(); return file }
    const w = Math.round(bmp.width * scale)
    const h = Math.round(bmp.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality))
    // si el "óptimo" salió más pesado que el original, el original gana
    if (!blob || blob.size >= file.size) return file
    const name = (file.name || 'image').replace(/\.[a-z0-9]+$/i, '') + (type === 'image/png' ? '.png' : '.jpg')
    return new File([blob], name, { type })
  } catch { return file }
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
  if (!m) return null
  try { return decodeURIComponent(m[1]) } catch { return null } // malformed encoding → no cleanup, never a crash
}
