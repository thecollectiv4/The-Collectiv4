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

/* v21 — BOOKING EN CASA. Bookings run on their OWN Stripe account/keys
   (BOOKINGS_* on Supabase Edge), SEPARATE from the ticket machine — so
   bookings can live in TEST while tickets sell LIVE. Stripe Embedded Checkout
   mounts client-side with the publishable key of the account that CREATED the
   session, so the booking checkout MUST use the booking account's publishable
   key — the ticket PUBLISHABLE_KEY above would fail to mount a booking session.
   It lives in its own build-time var; set it in Vercel for every environment
   (preview + prod) BEFORE the build. Missing key → getBookingStripe() resolves
   null and /book shows an honest error instead of a mute screen (Ley 11). */
const BOOKING_PUBLISHABLE_KEY = import.meta.env.VITE_BOOKINGS_STRIPE_PUBLISHABLE_KEY || ''

// its own cached promise — a distinct Stripe.js instance from the ticket one
let bookingStripePromise = null

export function getBookingStripe() {
  if (!BOOKING_PUBLISHABLE_KEY) return null
  if (!bookingStripePromise) bookingStripePromise = loadStripe(BOOKING_PUBLISHABLE_KEY)
  return bookingStripePromise
}

export const hasBookingStripeKey = Boolean(BOOKING_PUBLISHABLE_KEY)
