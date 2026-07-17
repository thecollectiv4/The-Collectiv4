import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { processTicketEmail } from './_ticketEmail.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
)

function generateQR() {
  return 'RBA2-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

export const config = { api: { bodyParser: false } }

async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Fail CLOSED: never accept an unverified webhook. If the secret isn't
  // configured, reject — do NOT fall back to parsing untrusted JSON.
  if (!endpointSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set — refusing unverified webhook')
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }
  const sig = req.headers['stripe-signature']
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' })
  }
  let event
  try {
    const rawBody = await getRawBody(req)
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret)
  } catch (err) {
    console.error('Webhook verification failed:', err.message)
    return res.status(400).json({ error: 'Webhook verification failed' })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const md = session.metadata || {}
    // Stable idempotency key. payment_intent is set for mode:'payment' checkout;
    // fall back to the session id so the dedup key is NEVER null.
    const paymentId = session.payment_intent || session.id
    try {
      // ---- Idempotency: Stripe delivers this event AT-LEAST-ONCE ----
      // If a ticket already exists for this payment, ack and stop — never create a
      // duplicate ticket or send a duplicate email on a retried delivery.
      // .limit(1) (not .maybeSingle): degrade gracefully if a legacy pre-index duplicate
      // exists — treat "any row found" as already-processed instead of throwing on >1 row.
      const { data: existingRows, error: lookupErr } = await supabase
        .from('tickets')
        .select('id')
        .eq('stripe_payment_id', paymentId)
        .limit(1)
      if (lookupErr) {
        // Can't confirm idempotency safely → ask Stripe to retry rather than risk a dup.
        console.error('Idempotency lookup failed — returning 500 for retry:', lookupErr)
        return res.status(500).json({ error: 'Idempotency check failed' })
      }
      if (existingRows && existingRows.length) {
        console.log('Duplicate webhook for payment ' + paymentId + ' — ticket already exists, skipping')
        return res.status(200).json({ received: true, duplicate: true })
      }

      const qrCode = generateQR()
      const buyerEmail = session.customer_email || (session.customer_details && session.customer_details.email)
      const buyerName = (session.customer_details && session.customer_details.name) || md.user_name || null

      if (!md.user_id) {
        // Checkout enforces user_id, so this should never fire. If it does, we still
        // record the paid ticket (never lose a payment) but it will be orphaned under RLS.
        console.warn('Webhook: checkout missing user_id metadata; ticket unreadable to buyer under RLS. session=' + session.id)
      }

      // .select('id') so the fast-path email has the row to claim. tier_name /
      // tier_id are persisted (from checkout metadata) so the ticket is self-
      // describing — the safety-net sweep can compose the same email later
      // without Stripe metadata in hand.
      const { data: inserted, error: insertError } = await supabase
        .from('tickets')
        .insert({
          event_id: md.event_id || null,
          buyer_email: buyerEmail,
          buyer_name: buyerName,
          buyer_id: md.user_id || '00000000-0000-0000-0000-000000000000',
          stripe_payment_id: paymentId,
          price_paid: session.amount_total,
          qr_code: qrCode,
          tier_name: md.tier_name || null,
          tier_id: md.tier || null,
          status: 'confirmed',
        })
        .select('id')
        .single()

      if (insertError) {
        // 23505 = unique_violation: a concurrent delivery already inserted this
        // payment (the tickets_stripe_payment_id_uidx index). That's success, not
        // failure — ack so Stripe stops retrying.
        if (insertError.code === '23505') {
          console.log('Concurrent duplicate for payment ' + paymentId + ' — already inserted, skipping')
          return res.status(200).json({ received: true, duplicate: true })
        }
        // Genuine persistence failure: do NOT ack. Return 500 so Stripe retries; the
        // idempotency guard above prevents a double-insert on that retry.
        console.error('Supabase insert error — returning 500 for Stripe retry:', insertError)
        return res.status(500).json({ error: 'Ticket persistence failed' })
      }

      console.log('Ticket created: ' + qrCode + ' for ' + buyerEmail)
      // FAST PATH: send the confirmation now, best-effort. The ticket is already
      // saved. processTicketEmail claims the row (email_sent_at lock), sends, and
      // on failure releases the claim + logs — so the daily safety-net sweep
      // recovers it. A send failure must NEVER 500 here: a Stripe retry would hit
      // the idempotency guard above and skip the email, so we never risk the ticket
      // over an email hiccup. The seed floor lives inside the claim.
      try {
        await processTicketEmail(supabase, inserted.id)
      } catch (mailErr) {
        console.error('Fast-path email raised (ticket is safe, sweep will retry):', mailErr.message)
      }
    } catch (err) {
      // Unexpected throw (e.g., network error to Supabase): ask Stripe to retry.
      console.error('Error processing checkout — returning 500 for Stripe retry:', err)
      return res.status(500).json({ error: 'Webhook processing error' })
    }
  }

  res.status(200).json({ received: true })
}
