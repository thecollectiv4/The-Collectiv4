import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET
const resend = new Resend(process.env.RESEND_API_KEY)
// Where the email CTA sends the buyer to claim + build their world.
const SITE = process.env.PUBLIC_SITE_URL || 'https://the-collectiv4.vercel.app'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
)

function generateQR() {
  return 'RBA2-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

function buildEmailHTML(data) {
  const { buyerName, qrCode, tier, amount, title, edition, eventDate, eventTime, venue } = data
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}&bgcolor=0A0908&color=F2E6D0&format=png`
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0A0D;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0D;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background:#0A0A0D;">
<tr><td style="padding:0 0 32px 0;"><span style="font-size:13px;font-weight:700;letter-spacing:3px;color:#F2EEE6;">THE COLLECTIV4</span></td></tr>
<tr><td style="padding:0 0 32px 0;"><div style="height:1px;background:#2C2C36;"></div></td></tr>
<tr><td style="padding:0 0 8px 0;"><span style="font-size:14px;letter-spacing:2px;color:#C7C4BC;">YOUR TICKET IS CONFIRMED</span></td></tr>
<tr><td style="padding:0 0 4px 0;"><span style="font-size:42px;font-weight:800;color:#F2EEE6;letter-spacing:1px;">${title}</span></td></tr>
<tr><td style="padding:0 0 28px 0;"><span style="font-size:32px;font-weight:800;color:#F2EEE6;letter-spacing:1px;">${edition}</span></td></tr>
<tr><td style="padding:20px 24px;background:#141418;border-radius:12px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:8px 0;border-bottom:1px solid #2C2C36;"><span style="font-size:11px;letter-spacing:2px;color:#83838F;">DATE</span><br><span style="font-size:18px;font-weight:700;color:#F2EEE6;">${eventDate}</span></td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #2C2C36;"><span style="font-size:11px;letter-spacing:2px;color:#83838F;">TIME</span><br><span style="font-size:18px;font-weight:700;color:#F2EEE6;">${eventTime}</span></td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #2C2C36;"><span style="font-size:11px;letter-spacing:2px;color:#83838F;">VENUE</span><br><span style="font-size:18px;font-weight:700;color:#F2EEE6;">${venue}</span></td></tr>
    <tr><td style="padding:8px 0;"><span style="font-size:11px;letter-spacing:2px;color:#83838F;">TICKET</span><br><span style="font-size:18px;font-weight:700;color:#F2EEE6;">${tier}</span><span style="font-size:14px;color:#83838F;"> &middot; $${(amount/100).toFixed(0)}</span></td></tr>
  </table>
</td></tr>
<tr><td align="center" style="padding:32px 0 16px 0;"><div style="display:inline-block;padding:20px;background:#F2EEE6;border-radius:16px;"><img src="${qrUrl}" alt="QR" width="200" height="200" style="display:block;border-radius:8px;"></div></td></tr>
<tr><td align="center" style="padding:0 0 8px 0;"><span style="font-size:16px;font-weight:700;letter-spacing:2px;color:#F2EEE6;">${qrCode}</span></td></tr>
<tr><td align="center" style="padding:0 0 28px 0;"><span style="font-size:12px;color:#83838F;">Show this QR code at the door</span></td></tr>
<tr><td align="center" style="padding:0 0 8px 0;"><a href="${SITE}/claim" style="display:inline-block;padding:16px 40px;background:#F2EEE6;color:#0A0A0D;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:1px;">CLAIM YOUR WORLD</a></td></tr>
<tr><td align="center" style="padding:0 0 32px 0;"><span style="font-size:12px;color:#83838F;">Build your profile — it’s how the room finds you</span></td></tr>
<tr><td style="padding:0 0 24px 0;"><div style="height:1px;background:#2C2C36;"></div></td></tr>
<tr><td align="center" style="padding:0 0 8px 0;"><span style="font-size:13px;font-weight:700;letter-spacing:3px;color:#F2EEE6;">THE COLLECTIV4</span></td></tr>
<tr><td align="center" style="padding:0 0 8px 0;"><span style="font-size:11px;letter-spacing:2px;color:#83838F;">ART &middot; MUSIC &middot; FASHION &middot; EVENTS</span></td></tr>
<tr><td align="center" style="padding:0 0 20px 0;"><a href="https://instagram.com/thecollectiv4" style="font-size:12px;color:#C7C4BC;text-decoration:none;">@thecollectiv4</a></td></tr>
</table></td></tr></table></body></html>`
}

async function sendConfirmationEmail(ticketData) {
  const { buyerEmail, buyerName, qrCode, pricePaid, tierName, event } = ticketData
  const ev = event || {}
  const title = ev.title || 'RAN BY ARTISTS'
  const edition = ev.edition || ''
  const eventDate = ev.event_date
    ? new Date(ev.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
    : 'TBA'
  const subject = `Your ticket to ${title}${edition ? ' — ' + edition : ''} 🎫`
  try {
    const { data, error } = await resend.emails.send({
      // NOTE: onboarding@resend.dev until the domain is verified (DNS in Wix) — step 7.
      from: 'The Collectiv4 <onboarding@resend.dev>',
      to: [buyerEmail],
      subject,
      html: buildEmailHTML({
        buyerName: buyerName || 'there',
        qrCode,
        tier: tierName || 'TICKET',
        amount: pricePaid || 0,
        title,
        edition,
        eventDate,
        eventTime: ev.doors || '',
        venue: ev.venue || '',
      }),
    })
    if (error) {
      console.error('Resend error:', error)
      await logEmailFailure(null, buyerEmail, JSON.stringify(error))
      return false
    }
    console.log('Email sent to ' + buyerEmail + ', id: ' + (data && data.id))
    return true
  } catch (err) {
    console.error('Email send failed:', err.message)
    await logEmailFailure(null, buyerEmail, err.message)
    return false
  }
}

async function logEmailFailure(ticketId, email, errorMessage) {
  try {
    await supabase.from('email_failures').insert({
      ticket_id: ticketId,
      email_address: email,
      error_message: errorMessage,
    })
  } catch (e) {
    console.error('Failed to log email failure:', e.message)
  }
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

      // Pull the event row (by id from checkout metadata) for accurate email content.
      let eventRow = null
      if (md.event_id) {
        const { data } = await supabase
          .from('events')
          .select('title, edition, event_date, doors, venue')
          .eq('id', md.event_id)
          .single()
        eventRow = data
      }

      if (!md.user_id) {
        // Checkout enforces user_id, so this should never fire. If it does, we still
        // record the paid ticket (never lose a payment) but it will be orphaned under RLS.
        console.warn('Webhook: checkout missing user_id metadata; ticket unreadable to buyer under RLS. session=' + session.id)
      }

      const { error: insertError } = await supabase.from('tickets').insert({
        event_id: md.event_id || null,
        buyer_email: buyerEmail,
        buyer_name: buyerName,
        buyer_id: md.user_id || '00000000-0000-0000-0000-000000000000',
        stripe_payment_id: paymentId,
        price_paid: session.amount_total,
        qr_code: qrCode,
        status: 'confirmed',
      })

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
      // Email is best-effort: the ticket is already saved. A failure is logged to
      // email_failures and must NOT trigger a 500 — a retry would skip the email via
      // the idempotency guard, so we never want to lose the ticket over an email hiccup.
      await sendConfirmationEmail({
        buyerEmail,
        buyerName,
        qrCode,
        pricePaid: session.amount_total,
        tierName: md.tier_name || 'TICKET',
        event: eventRow,
      })
    } catch (err) {
      // Unexpected throw (e.g., network error to Supabase): ask Stripe to retry.
      console.error('Error processing checkout — returning 500 for Stripe retry:', err)
      return res.status(500).json({ error: 'Webhook processing error' })
    }
  }

  res.status(200).json({ received: true })
}
