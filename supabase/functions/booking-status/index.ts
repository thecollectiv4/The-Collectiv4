// booking-status — the success page polls the TRUTH in the DB before it says
// "booked" (ClaimWorld discipline: never a confirmation without a row behind
// it). The (bid, session_id) pair acts as the bearer: both come from the
// Stripe redirect and the pair is unguessable.
//
// Deploy: supabase functions deploy booking-status --use-api --no-verify-jwt

import { admin, cors, json } from '../_shared/booking.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405)

  const url = new URL(req.url)
  const bid = url.searchParams.get('bid') || ''
  const sessionId = url.searchParams.get('session_id') || ''
  if (!UUID_RE.test(bid) || !sessionId.startsWith('cs_')) {
    return json({ error: 'bad_request' }, 400)
  }

  const db = admin()
  const { data: booking, error } = await db
    .from('bookings')
    .select('id, status, service_title, price_cents, currency, client_name, creative_id')
    .eq('id', bid)
    .eq('stripe_session_id', sessionId)
    .maybeSingle()
  if (error) return json({ error: 'db_error' }, 500)
  if (!booking) return json({ error: 'not_found' }, 404)

  let creativeName = null
  const { data: creative } = await db
    .from('profiles')
    .select('full_name, username, is_demo')
    .eq('id', booking.creative_id)
    .maybeSingle()
  if (creative) creativeName = creative.full_name || creative.username

  return json({
    status: booking.status,
    service_title: booking.service_title,
    price_cents: booking.price_cents,
    currency: booking.currency,
    client_name: booking.client_name,
    creative_name: creativeName,
  })
})
