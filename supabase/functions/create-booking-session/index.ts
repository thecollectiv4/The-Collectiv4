// create-booking-session — a client (usually with no account, reached by DM)
// pays a creative's service. Mirrors the ticket machine's contract without
// touching it: price read authoritatively from the DB in cents, session
// created server-side, metadata self-describing, row born before money moves.
//
// Deploy: supabase functions deploy create-booking-session --use-api --no-verify-jwt
// (--no-verify-jwt because the buyer has no session — this page is the
// acquisition channel; validation below is the gate.)

import { admin, cors, json, safeOrigin, stripeClient } from '../_shared/booking.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const stripe = stripeClient()
  if (!stripe) return json({ error: 'payments_not_configured' }, 503)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_json' }, 400)
  }

  const b = body as {
    listingId?: string
    agreed?: boolean
    client?: { name?: string; email?: string }
    request?: { brief?: string; date?: string; place?: string; links?: string }
  }

  const listingId = String(b.listingId || '').trim()
  const clientName = String(b.client?.name || '').trim().slice(0, 120)
  const clientEmail = String(b.client?.email || '').trim().toLowerCase().slice(0, 200)
  const request = {
    brief: String(b.request?.brief || '').trim().slice(0, 1000),
    date: String(b.request?.date || '').trim().slice(0, 40),
    place: String(b.request?.place || '').trim().slice(0, 160),
    links: String(b.request?.links || '').trim().slice(0, 400),
  }

  if (!listingId) return json({ error: 'listing_required' }, 400)
  if (!clientName) return json({ error: 'name_required' }, 400)
  if (!clientEmail.includes('@')) return json({ error: 'email_required' }, 400)
  if (!request.brief) return json({ error: 'brief_required' }, 400)
  if (b.agreed !== true) return json({ error: 'terms_required' }, 400)

  const db = admin()

  // the price is read from the DB, never from the client
  const { data: listing, error: lerr } = await db
    .from('listings')
    .select('id, kind, title, price_cents, currency, status, delivery, profile_id')
    .eq('id', listingId)
    .maybeSingle()
  if (lerr) return json({ error: 'db_error' }, 500)
  if (!listing || listing.kind !== 'service' || listing.status !== 'live') {
    return json({ error: 'service_not_available' }, 404)
  }

  const { data: creative, error: perr } = await db
    .from('profiles')
    .select('id, full_name, username, is_demo, deleted_at')
    .eq('id', listing.profile_id)
    .maybeSingle()
  if (perr) return json({ error: 'db_error' }, 500)
  // integrity: demo identities never enter the money path
  if (!creative || creative.is_demo || creative.deleted_at) {
    return json({ error: 'service_not_available' }, 404)
  }

  // C4's fee comes from config, snapshotted onto the booking
  let feeBps = 1500
  const { data: cfg } = await db
    .from('app_config')
    .select('value')
    .eq('key', 'booking_fee_bps')
    .maybeSingle()
  if (cfg && Number.isFinite(Number(cfg.value))) feeBps = Number(cfg.value)

  // the row is born before the money moves — pending until the webhook
  // hears from Stripe
  const { data: bookingRow, error: berr } = await db
    .from('bookings')
    .insert({
      listing_id: listing.id,
      creative_id: creative.id,
      service_title: listing.title,
      price_cents: listing.price_cents,
      fee_bps: feeBps,
      currency: listing.currency || 'usd',
      client_name: clientName,
      client_email: clientEmail,
      request,
      status: 'pending',
    })
    .select('id')
    .single()
  if (berr || !bookingRow) return json({ error: 'db_error' }, 500)

  const origin = safeOrigin(req.headers.get('origin'))
  const creativeName = creative.full_name || creative.username || 'a Collectiv4 creative'

  let session
  try {
    // payment_method_types deliberately omitted: Stripe shows card plus
    // Apple Pay / Google Pay per the dashboard's payment-method config
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: clientEmail,
      billing_address_collection: 'auto',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: listing.currency || 'usd',
            unit_amount: listing.price_cents,
            product_data: {
              name: `${listing.title} — ${creativeName}`,
              ...(listing.delivery ? { description: listing.delivery } : {}),
            },
          },
        },
      ],
      metadata: {
        kind: 'booking',
        booking_id: bookingRow.id,
        listing_id: listing.id,
        creative_id: creative.id,
        price_cents: String(listing.price_cents),
        fee_bps: String(feeBps),
        client_name: clientName,
      },
      success_url: `${origin}/booked?bid=${bookingRow.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book/${listing.id}?cancelled=1`,
    })
  } catch (e) {
    console.error('stripe session failed', e)
    await db.from('bookings').delete().eq('id', bookingRow.id).eq('status', 'pending')
    return json({ error: 'stripe_error' }, 502)
  }

  // the status page authenticates its polling with (bid, session_id) —
  // if we can't record the pair, the link must not go out
  const { error: uerr } = await db
    .from('bookings')
    .update({ stripe_session_id: session.id })
    .eq('id', bookingRow.id)
  if (uerr) return json({ error: 'db_error' }, 500)

  return json({ url: session.url })
})
