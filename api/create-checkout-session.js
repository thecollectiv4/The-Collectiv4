import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Service key bypasses RLS so the API can read the event/tier authoritatively.
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { eventSlug, tier, email, quantity = 1, userName, userId } = req.body

    if (!eventSlug || !tier) {
      return res.status(400).json({ error: 'Missing event or tier' })
    }
    if (!userId) {
      // Paid checkout requires a logged-in user so the resulting ticket is
      // owner-readable under RLS (tickets_self_read keys on buyer_id).
      return res.status(400).json({ error: 'Sign in required to purchase' })
    }

    // Event + tiers come from the DB now (multi-event, nothing hardcoded).
    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('id, slug, title, edition, event_date, venue, tiers, status')
      .eq('slug', eventSlug)
      .single()

    if (evErr || !event) {
      return res.status(404).json({ error: 'Event not found' })
    }
    if (event.status === 'draft') {
      return res.status(400).json({ error: 'Event not available' })
    }

    const tierData = (event.tiers || []).find((t) => t.id === tier)
    if (!tierData) {
      return res.status(400).json({ error: 'Invalid ticket tier' })
    }
    if (tierData.status !== 'available') {
      return res.status(400).json({ error: 'This tier is not available yet' })
    }

    const origin = req.headers.origin || 'https://the-collectiv4.vercel.app'
    const eventDateStr = event.event_date
      ? new Date(event.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : ''
    const productName = `${event.title}${event.edition ? ' — ' + event.edition : ''} · ${tierData.name}`

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            description: [eventDateStr, event.venue].filter(Boolean).join(' · '),
            images: [],
          },
          unit_amount: tierData.price, // CENTS, from the DB
        },
        quantity: Math.min(Number(quantity) || 1, 5),
      }],
      success_url: `${origin}/?ticket=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?ticket=cancelled`,
      metadata: {
        event_id: event.id,
        event_slug: event.slug,
        tier: tierData.id,
        tier_name: tierData.name,
        amount: String(tierData.price),
        user_name: userName || '',
        user_id: userId || '',
      },
      customer_email: email || undefined,
      billing_address_collection: 'auto',
    })

    res.status(200).json({ url: session.url, sessionId: session.id })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
