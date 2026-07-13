import { supabase } from '@/api/supabase'
import { uploadWorldImage, removeWorldImages } from '@/lib/worldStorage'

/* =========================================================================
   listings — the OFFER (migration 0017): pieces and services with a real
   price, hanging in a member's world. This layer is "exist and show
   honestly": there is NO payment path yet, so every buy affordance is
   "DM to buy" — a door that opens a real conversation (Ley 11).

   Images ride the 'worlds' bucket under the owner's own uid folder
   ('l-' prefix) — the same server-side storage RLS as the gallery.
   DEGRADES HONESTLY pre-migration: reads → empty, writes → a human line.
   ========================================================================= */

const MISSING = /listings|schema cache|does not exist|Could not find/i

export const KINDS = {
  piece:   { label: 'PIECE',   cta: 'DM to buy' },
  service: { label: 'SERVICE', cta: 'DM to book' },
}

export const priceLabel = (cents) => {
  if (!Number.isFinite(Number(cents))) return ''
  const n = Number(cents)
  return `$${n % 100 === 0 ? n / 100 : (n / 100).toFixed(2)}`
}

export const normListings = (rows) => (Array.isArray(rows) ? rows : [])
  .map((r) => ({ ...r, images: Array.isArray(r.images) ? r.images.filter((x) => x && x.url) : [] }))

/* Public + owner read: live listings for a world (owner sees all states).
   RLS mirrors the world's own visibility. Empty on any failure. */
export async function fetchListings(profileId) {
  if (!profileId) return []
  const { data, error } = await supabase
    .from('listings')
    .select('id,profile_id,kind,title,description,price_cents,currency,images,status,created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) return []
  return normListings(data)
}

/* Upload each image into the caller's own folder, then insert the row.
   A failure anywhere cleans up every object already uploaded. */
export async function createListing(userId, { kind, title, description = '', priceCents, files = [] }) {
  const images = []
  try {
    for (const f of files) {
      const { path, url } = await uploadWorldImage(userId, f, 'l')
      images.push({ path, url })
    }
  } catch (e) {
    removeWorldImages(images.map((i) => i.path))
    throw e
  }
  const { data, error } = await supabase
    .from('listings')
    .insert({
      profile_id: userId,
      kind,
      title: (title || '').trim(),
      description: (description || '').trim() || null,
      price_cents: priceCents,
      images,
    })
    .select('id,profile_id,kind,title,description,price_cents,currency,images,status,created_at')
    .single()
  if (error) {
    removeWorldImages(images.map((i) => i.path))
    if (MISSING.test(error.message || '')) {
      throw new Error("the offer isn't switched on yet — the platform update is on its way. nothing was lost.")
    }
    throw new Error(error.message || "couldn't publish the listing")
  }
  return data
}

/* Owner: archive / relist / mark sold. */
export async function setListingStatus(id, status) {
  const { error } = await supabase.from('listings').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message || "couldn't update")
}

/* Owner delete: the row first (source of truth), storage best-effort after. */
export async function deleteListing(listing) {
  const { error } = await supabase.from('listings').delete().eq('id', listing.id)
  if (error) throw new Error(error.message || "couldn't delete")
  removeWorldImages((listing.images || []).map((i) => i.path).filter(Boolean))
}
