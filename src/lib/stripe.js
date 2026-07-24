import { loadStripe } from '@stripe/stripe-js'

/* v20 — EL PAGO EN CASA. The client now mounts Stripe Embedded Checkout on our
   own domain, so it needs the PUBLISHABLE key (safe to ship — it is not a
   secret). It lives in VITE_STRIPE_PUBLISHABLE_KEY, resolved at BUILD time by
   Vite, so it must be set in Vercel for every environment (preview + prod)
   BEFORE the build. Missing key → getStripe() resolves null and the checkout
   surface shows an honest error instead of a mute screen (Ley 11). */
const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''

// loadStripe fetches Stripe.js from the network once; cache the promise so a
// remount never reloads it. Null when no key is configured — callers branch.
let stripePromise = null

export function getStripe() {
  if (!PUBLISHABLE_KEY) return null
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY)
  return stripePromise
}

export const hasStripeKey = Boolean(PUBLISHABLE_KEY)
