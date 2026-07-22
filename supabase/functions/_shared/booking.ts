// Shared plumbing for the booking payment layer.
// These functions live on Supabase Edge (Deno) because api/ — the ticket
// payment machine — is frozen by tree hash and Vercel only serves
// serverless functions from that directory in this layout.

import Stripe from 'npm:stripe@17.7.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// service-role client — RLS does not apply; every read/write here is
// deliberate and minimal
export function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

// Bookings run on their OWN Stripe keys (BOOKINGS_*), separate from the
// ticket machine's — so bookings can live in test mode while tickets sell live.
export function stripeClient(): Stripe | null {
  const key = Deno.env.get('BOOKINGS_STRIPE_SECRET_KEY')
  if (!key) return null
  return new Stripe(key, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })
}

// success/cancel URLs only ever point at our own surfaces
const ORIGIN_RE =
  /^(https:\/\/([a-z0-9-]+\.)*vercel\.app|https:\/\/(www\.)?thecollectiv4\.com|http:\/\/localhost:\d+)$/
export function safeOrigin(o: string | null): string {
  if (o && ORIGIN_RE.test(o)) return o
  return Deno.env.get('PUBLIC_SITE_URL') || 'https://the-collectiv4.vercel.app'
}

export const feeCents = (priceCents: number, bps: number) =>
  Math.round((priceCents * bps) / 10000)
