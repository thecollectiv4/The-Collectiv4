// booking-webhook — Stripe tells us a booking was paid. Same contract as the
// ticket machine's webhook, rebuilt on Edge: signature verified on the raw
// body, fail closed without the secret, idempotent, money recorded before
// any email is attempted, email failures never fail the webhook.
//
// Deploy: supabase functions deploy booking-webhook --use-api --no-verify-jwt
// (Stripe sends no Supabase JWT; the stripe-signature check IS the auth.)
// Stripe dashboard endpoint URL:
//   https://<project-ref>.supabase.co/functions/v1/booking-webhook

import Stripe from 'npm:stripe@17.7.0'
import { admin, feeCents, json } from '../_shared/booking.ts'

const cryptoProvider = Stripe.createSubtleCryptoProvider()

const fmtMoney = (cents: number, currency: string) =>
  `$${(cents / 100).toFixed(2)} ${String(currency || 'usd').toUpperCase()}`

// every user-authored string that reaches email HTML goes through this
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const key = Deno.env.get('BOOKINGS_STRIPE_SECRET_KEY')
  const secret = Deno.env.get('BOOKINGS_STRIPE_WEBHOOK_SECRET')
  if (!key || !secret) return json({ error: 'not_configured' }, 500) // fail closed

  const sig = req.headers.get('stripe-signature')
  if (!sig) return json({ error: 'missing_signature' }, 400)

  const raw = await req.text()
  const stripe = new Stripe(key, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret, undefined, cryptoProvider)
  } catch {
    return json({ error: 'bad_signature' }, 400)
  }

  // Three session events matter. payment_method_types is dashboard-driven in
  // create-booking-session, so an async method (ACH, SEPA, …) could be enabled
  // there someday: `completed` then arrives with payment_status 'unpaid' and
  // the truth comes later via async_payment_succeeded / _failed. A booking is
  // only ever called paid when Stripe says the money is actually captured.
  const HANDLED = [
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
  ]
  if (!HANDLED.includes(event.type)) {
    return json({ received: true, ignored: event.type })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const md = session.metadata || {}
  if (md.kind !== 'booking' || !md.booking_id) {
    return json({ received: true, ignored: 'not_a_booking' })
  }

  const db = admin()

  if (event.type === 'checkout.session.async_payment_failed') {
    // the async collection died — the pending row closes honestly
    const { error } = await db
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', md.booking_id)
      .eq('status', 'pending')
    if (error) return json({ error: 'db_error' }, 500)
    return json({ received: true, cancelled: true })
  }

  if (event.type === 'checkout.session.completed' && session.payment_status !== 'paid') {
    // checkout finished but the money hasn't been captured yet (async
    // method) — leave the row pending; async_payment_succeeded closes it
    return json({ received: true, awaiting_async_payment: true })
  }

  const paymentId =
    (typeof session.payment_intent === 'string' ? session.payment_intent : null) || session.id

  // idempotent: only a pending row moves to paid; a retry finds nothing
  const { data: updated, error: uerr } = await db
    .from('bookings')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_id: paymentId,
    })
    .eq('id', md.booking_id)
    .eq('status', 'pending')
    .select(
      'id, client_email, client_name, service_title, price_cents, fee_bps, currency, creative_id, request',
    )

  if (uerr) {
    // concurrent duplicate hit the unique index — the payment is recorded
    if (uerr.code === '23505') return json({ received: true, duplicate: true })
    return json({ error: 'db_error' }, 500) // Stripe retries
  }

  if (!updated || updated.length === 0) {
    const { data: existing, error: lerr } = await db
      .from('bookings')
      .select('id, status')
      .eq('id', md.booking_id)
      .maybeSingle()
    if (lerr) return json({ error: 'db_error' }, 500)
    if (existing && existing.status !== 'pending') {
      return json({ received: true, duplicate: true })
    }
    // a paid session pointing at no row is a real problem — let Stripe retry
    return json({ error: 'booking_not_found' }, 500)
  }

  // the money is recorded — everything past this line is best-effort
  try {
    await sendEmails(db, updated[0])
  } catch (e) {
    console.error('booking email failed (booking is safe):', e)
  }

  return json({ received: true })
})

// deno-lint-ignore no-explicit-any
async function sendEmails(db: any, booking: any) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return

  const site = Deno.env.get('PUBLIC_SITE_URL') || 'https://the-collectiv4.vercel.app'
  const from = 'The Collectiv4 <bookings@send.thecollectiv4.com>'
  const price = fmtMoney(booking.price_cents, booking.currency)
  const net = fmtMoney(booking.price_cents - feeCents(booking.price_cents, booking.fee_bps), booking.currency)

  const send = (to: string, subject: string, html: string) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    })

  const shell = (inner: string) => `
  <div style="background:#0A0A0D;color:#F2EEE6;font-family:Georgia,serif;padding:40px 24px;">
    <div style="max-width:520px;margin:0 auto;">
      <p style="font-family:monospace;font-size:11px;letter-spacing:.2em;color:#83838F;margin:0 0 24px;">THE COLLECTIV4</p>
      ${inner}
      <p style="font-family:monospace;font-size:10px;letter-spacing:.15em;color:#4C4C57;margin:32px 0 0;">FOR THE PEOPLE — 4</p>
    </div>
  </div>`

  // the client's receipt doubles as the invitation into the room
  await send(
    booking.client_email,
    `Booked — ${booking.service_title}`,
    shell(`
      <h1 style="font-size:28px;margin:0 0 16px;color:#F2EEE6;">You're booked.</h1>
      <p style="margin:0 0 8px;color:#C7C4BC;">${esc(booking.service_title)} — ${price}, paid.</p>
      <p style="margin:0 0 24px;color:#C7C4BC;">Your creative has the full request and will reach out at this address.</p>
      <p style="margin:0 0 24px;color:#83838F;">This booking happened inside The Collectiv4 — the room where the city's creatives live. Your booking is the door.</p>
      <a href="${site}/auth" style="display:inline-block;background:#F2EEE6;color:#0A0A0D;padding:12px 24px;text-decoration:none;font-family:monospace;font-size:12px;letter-spacing:.15em;">CLAIM YOUR WORLD</a>
    `),
  )

  // the creative learns their money moved, with the honest net line
  const { data: userData } = await db.auth.admin.getUserById(booking.creative_id)
  const creativeEmail = userData?.user?.email
  if (!creativeEmail) return

  const r = booking.request || {}
  const requestLines = [
    r.brief ? `<p style="margin:0 0 6px;color:#C7C4BC;">${esc(r.brief)}</p>` : '',
    r.date ? `<p style="margin:0 0 6px;color:#83838F;">When: ${esc(r.date)}</p>` : '',
    r.place ? `<p style="margin:0 0 6px;color:#83838F;">Where: ${esc(r.place)}</p>` : '',
    r.links ? `<p style="margin:0 0 6px;color:#83838F;">References: ${esc(r.links)}</p>` : '',
  ].join('')

  await send(
    creativeEmail,
    `New booking — ${booking.service_title}`,
    shell(`
      <h1 style="font-size:28px;margin:0 0 16px;color:#F2EEE6;">You got booked.</h1>
      <p style="margin:0 0 8px;color:#C7C4BC;">${esc(booking.client_name)} paid ${price} for ${esc(booking.service_title)}.</p>
      <p style="margin:0 0 24px;color:#83838F;">You keep ${net} after the C4 fee. The full request:</p>
      ${requestLines}
      <a href="${site}/bookings" style="display:inline-block;margin-top:24px;background:#F2EEE6;color:#0A0A0D;padding:12px 24px;text-decoration:none;font-family:monospace;font-size:12px;letter-spacing:.15em;">OPEN YOUR BOOKINGS</a>
    `),
  )
}
