import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET
const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
)

function generateQR() {
  return 'RBA2-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

function buildEmailHTML(data) {
  const { buyerName, qrCode, tier, amount, eventDate, eventTime, venue } = data
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}&bgcolor=0A0908&color=F2E6D0&format=png`
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0908;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0908;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background:#0A0908;">
<tr><td style="padding:0 0 32px 0;"><span style="font-size:13px;font-weight:700;letter-spacing:3px;color:#F2E6D0;">THE COLLECTIV4</span></td></tr>
<tr><td style="padding:0 0 32px 0;"><div style="height:1px;background:#2A2620;"></div></td></tr>
<tr><td style="padding:0 0 8px 0;"><span style="font-size:14px;letter-spacing:2px;color:#A09888;">YOUR TICKET IS CONFIRMED</span></td></tr>
<tr><td style="padding:0 0 4px 0;"><span style="font-size:42px;font-weight:800;color:#F2E6D0;letter-spacing:1px;">RAN BY ARTISTS</span></td></tr>
<tr><td style="padding:0 0 28px 0;"><span style="font-size:32px;font-weight:800;color:#D06020;letter-spacing:1px;">EDITION 002</span></td></tr>
<tr><td style="padding:20px 24px;background:#141210;border-radius:12px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:8px 0;border-bottom:1px solid #2A2620;"><span style="font-size:11px;letter-spacing:2px;color:#686058;">DATE</span><br><span style="font-size:18px;font-weight:700;color:#F2E6D0;">${eventDate}</span></td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #2A2620;"><span style="font-size:11px;letter-spacing:2px;color:#686058;">TIME</span><br><span style="font-size:18px;font-weight:700;color:#F2E6D0;">${eventTime}</span></td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #2A2620;"><span style="font-size:11px;letter-spacing:2px;color:#686058;">VENUE</span><br><span style="font-size:18px;font-weight:700;color:#F2E6D0;">${venue}</span></td></tr>
    <tr><td style="padding:8px 0;"><span style="font-size:11px;letter-spacing:2px;color:#686058;">TICKET</span><br><span style="font-size:18px;font-weight:700;color:#F2E6D0;">${tier}</span><span style="font-size:14px;color:#686058;"> &middot; $${(amount/100).toFixed(0)}</span></td></tr>
  </table>
</td></tr>
<tr><td align="center" style="padding:32px 0 16px 0;"><div style="display:inline-block;padding:20px;background:#F2E6D0;border-radius:16px;"><img src="${qrUrl}" alt="QR" width="200" height="200" style="display:block;border-radius:8px;"></div></td></tr>
<tr><td align="center" style="padding:0 0 8px 0;"><span style="font-size:16px;font-weight:700;letter-spacing:2px;color:#F2E6D0;">${qrCode}</span></td></tr>
<tr><td align="center" style="padding:0 0 32px 0;"><span style="font-size:12px;color:#686058;">Show this QR code at the door</span></td></tr>
<tr><td align="center" style="padding:0 0 32px 0;"><a href="https://the-collectiv4.vercel.app/profile" style="display:inline-block;padding:16px 40px;background:#F2E6D0;color:#0A0908;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:1px;">VIEW YOUR TICKET</a></td></tr>
<tr><td style="padding:0 0 24px 0;"><div style="height:1px;background:#2A2620;"></div></td></tr>
<tr><td align="center" style="padding:0 0 8px 0;"><span style="font-size:13px;font-weight:700;letter-spacing:3px;color:#F2E6D0;">THE COLLECTIV4</span></td></tr>
<tr><td align="center" style="padding:0 0 8px 0;"><span style="font-size:11px;letter-spacing:2px;color:#686058;">ART &middot; MUSIC &middot; FASHION &middot; EVENTS</span></td></tr>
<tr><td align="center" style="padding:0 0 20px 0;"><a href="https://instagram.com/thecollectiv4" style="font-size:12px;color:#A09888;text-decoration:none;">@thecollectiv4</a></td></tr>
</table></td></tr></table></body></html>`
}

async function sendConfirmationEmail(ticketData) {
  const { buyerEmail, buyerName, qrCode, pricePaid } = ticketData
  try {
    const { data, error } = await resend.emails.send({
      from: 'The Collectiv4 <onboarding@resend.dev>',
      to: [buyerEmail],
      subject: 'Your ticket to Ran By Artists — Edition 002 🎫',
      html: buildEmailHTML({
        buyerName: buyerName || 'there',
        qrCode,
        tier: 'EARLY BIRD',
        amount: pricePaid || 1500,
        eventDate: 'MAY 30, 2026',
        eventTime: '10 PM – 2 AM',
        venue: 'Houston · Venue reveal soon',
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

  let event
  try {
    const rawBody = await getRawBody(req)
    const sig = req.headers['stripe-signature']
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret)
    } else {
      event = JSON.parse(rawBody.toString())
    }
  } catch (err) {
    console.error('Webhook verification failed:', err.message)
    return res.status(400).json({ error: 'Webhook verification failed' })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    try {
      const qrCode = generateQR()
      const buyerEmail = session.customer_email || (session.customer_details && session.customer_details.email)
      const buyerName = (session.customer_details && session.customer_details.name) || (session.metadata && session.metadata.user_name) || null

      const { error } = await supabase.from('tickets').insert({
        buyer_email: buyerEmail,
        buyer_name: buyerName,
        buyer_id: (session.metadata && session.metadata.user_id) || '00000000-0000-0000-0000-000000000000',
        stripe_payment_id: session.payment_intent,
        price_paid: session.amount_total,
        qr_code: qrCode,
        status: 'confirmed',
      })

      if (error) {
        console.error('Supabase insert error:', error)
      } else {
        console.log('Ticket created: ' + qrCode + ' for ' + buyerEmail)
        await sendConfirmationEmail({ buyerEmail, buyerName, qrCode, pricePaid: session.amount_total })
      }
    } catch (err) {
      console.error('Error processing checkout:', err)
    }
  }

  res.status(200).json({ received: true })
}
