import { supabase } from '@/api/supabase'

/* =========================================================================
   bookings — the payment path of the OFFER (migration 0051): a client,
   usually with no account, pays a creative's service through a shared
   link. The money endpoints live on Supabase Edge Functions because api/
   (the ticket machine) is frozen by tree hash and Vercel only serves
   serverless from that directory.

   Same discipline as tickets: the DB is the source of truth — a booking
   is only ever called paid after the row says so (ClaimWorld doctrine).
   DEGRADES HONESTLY: reads → empty, writes → a human line.
   ========================================================================= */

// same project the supabase client points at (src/api/supabase.js)
const FUNCTIONS_URL = 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co/functions/v1'

export const fmtMoney = (cents) => {
  if (!Number.isFinite(Number(cents))) return ''
  const n = Number(cents)
  return `$${n % 100 === 0 ? n / 100 : (n / 100).toFixed(2)}`
}

export const feeCents = (priceCents, feeBps) => Math.round((priceCents * feeBps) / 10000)
export const netCents = (priceCents, feeBps) => priceCents - feeCents(priceCents, feeBps)

// the shareable payment link — what a creative pastes into a DM
export const bookingLink = (listingId) => `${window.location.origin}/book/${listingId}`

/* The public payment page's read: the service + the creative behind it.
   RLS does the gating (live + non-demo for the public). is_demo rides the
   profile select — guardrail 4. */
export async function fetchService(listingId) {
  if (!listingId) return null
  const { data: listing, error } = await supabase
    .from('listings')
    .select('id,profile_id,kind,title,description,price_cents,currency,images,status,delivery')
    .eq('id', listingId)
    .eq('kind', 'service')
    .maybeSingle()
  if (error || !listing) return null
  const { data: creative } = await supabase
    .from('profiles')
    .select('id,full_name,username,avatar_url,bio,city,verified,is_demo')
    .eq('id', listing.profile_id)
    .maybeSingle()
  if (!creative) return null
  return { listing, creative }
}

/* v21 — BOOKING EN CASA. Ask the edge function for an EMBEDDED Stripe session:
   the card form mounts INSIDE /book (see lib/stripe.getBookingStripe) instead
   of bouncing to checkout.stripe.com. The price is read server-side from the
   DB — nothing money-shaped leaves this client. Returns { clientSecret, bid };
   the return_url (with bid) is baked server-side, so /booked polls the truth.

   The edge fn is additive: it still answers a hosted { url } when `embedded`
   is omitted (backward compat / rollback). This client always goes embedded. */
export async function createBookingSession({ listingId, client, request, agreed }) {
  const res = await fetch(`${FUNCTIONS_URL}/create-booking-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId, client, request, agreed, embedded: true }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.clientSecret) {
    const human = {
      payments_not_configured: 'payments aren’t switched on yet — nothing was charged.',
      service_not_available: 'this service isn’t available anymore.',
      terms_required: 'please accept the booking terms first.',
    }
    throw new Error(human[data.error] || 'couldn’t start the payment — nothing was charged. try again.')
  }
  return { clientSecret: data.clientSecret, bid: data.bid }
}

/* The success page polls the truth. (bid, session_id) both come from the
   Stripe redirect; the pair is the bearer. Null on any failure. */
export async function fetchBookingStatus(bid, sessionId) {
  try {
    const res = await fetch(
      `${FUNCTIONS_URL}/booking-status?bid=${encodeURIComponent(bid)}&session_id=${encodeURIComponent(sessionId)}`,
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/* The creative's own bookings, newest first. RLS scopes to their rows. */
export async function fetchMyBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('id,listing_id,service_title,client_name,client_email,request,price_cents,fee_bps,currency,status,created_at,paid_at,delivered_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return []
  return Array.isArray(data) ? data : []
}

/* paid → delivered, on the creative's own row, via the gated RPC. */
export async function markDelivered(bookingId) {
  const { data, error } = await supabase.rpc('booking_mark_delivered', { p_booking_id: bookingId })
  if (error) throw new Error(error.message || 'couldn’t update')
  if (!data?.ok) throw new Error('couldn’t update — only a paid booking can be marked delivered')
  return data
}
