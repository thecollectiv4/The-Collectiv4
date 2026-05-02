import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const TIERS = {
  'early-bird': { name: 'RBA Edition 2 — Early Bird', price: 1500, active: true },
  'general':    { name: 'RBA Edition 2 — General',    price: 2500, active: false },
  'late':       { name: 'RBA Edition 2 — Late',       price: 3500, active: false },
  'door':       { name: 'RBA Edition 2 — Door',       price: 4000, active: false },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { tier, email, quantity = 1 } = req.body

    const tierData = TIERS[tier]
    if (!tierData) {
      return res.status(400).json({ error: 'Invalid ticket tier' })
    }
    if (!tierData.active) {
      return res.status(400).json({ error: 'This tier is not available yet' })
    }

    const origin = req.headers.origin || 'https://the-collectiv4.vercel.app'

    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: tierData.name,
            description: 'Ran By Artists Edition 2 — May 30, 2026 · Houston, TX',
            images: [],
          },
          unit_amount: tierData.price,
        },
        quantity: Math.min(quantity, 5),
      }],
      success_url: `${origin}/?ticket=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?ticket=cancelled`,
      metadata: {
        tier,
        event: 'rba-edition-2',
        event_date: '2026-05-30',
      },
    }

    if (email) {
      sessionParams.customer_email = email
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    res.status(200).json({ url: session.url, sessionId: session.id })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
