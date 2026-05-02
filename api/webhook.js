import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
)

function generateQR() {
  return 'RBA2-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

export const config = {
  api: { bodyParser: false }
}

async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: 'Webhook verification failed' })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    try {
      const qrCode = generateQR()

      // Create ticket in Supabase
      const { error } = await supabase.from('tickets').insert({
        email: session.customer_email || session.customer_details?.email,
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent,
        tier: session.metadata?.tier || 'general',
        amount_paid: session.amount_total,
        qr_code: qrCode,
        status: 'confirmed',
        event_id: session.metadata?.event || 'rba-edition-2',
        checked_in: false,
        created_at: new Date().toISOString(),
      })

      if (error) {
        console.error('Supabase insert error:', error)
      } else {
        console.log(`Ticket created: ${qrCode} for ${session.customer_email || session.customer_details?.email}`)
      }
    } catch (err) {
      console.error('Error processing checkout:', err)
    }
  }

  res.status(200).json({ received: true })
}
