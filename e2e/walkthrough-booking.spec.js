// @ts-check
import { test, expect } from '@playwright/test'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

/* =========================================================================
   THE BOOKING WALKTHROUGH (v21 · BOOKING EN CASA) — the SECOND money machine.
   v19 built the safety net for tickets; this is its twin for BOOKINGS: a
   client (usually with no account, reached by DM) pays a creative's service.
   Every other booking check stopped at checkout.stripe.com; this one rides
   the whole chain to a real bookings ROW that flips pending → paid.

   WHY IT LIVES ON SUPABASE EDGE, NOT api/: the ticket machine (api/) is frozen
   by tree hash; booking's money endpoints are Supabase Edge Functions
   (create-booking-session, booking-webhook, booking-status) on their OWN
   Stripe keys (BOOKINGS_*), so bookings can run in TEST mode while tickets
   sell LIVE. This spec therefore talks HTTP to the deployed functions, not to
   the Vercel deploy — FUNCTIONS_URL, not PREVIEW_URL, for the money half.

   WHAT IT COVERS (against the REAL deployed edge functions):
     A · THE EMBEDDED SWITCH + backward-compat, proven deterministically.
         A1: create-booking-session called with { embedded: true } must answer
             a clientSecret (to mount in-app) and NO checkout.stripe.com URL —
             the proof the fn learned ui_mode 'embedded_page' (v21). It also
             must be born honestly: a bookings ROW exists in status 'pending',
             at the right price, tied to the right creative + listing, BEFORE
             any money moves.
         A2: the SAME fn called WITHOUT the flag still answers a hosted { url }
             (checkout.stripe.com) — the additive contract that keeps prod
             booking alive until the frontend merges. This is the baseline that
             was green against the OLD flow and stays green after v21.
     B · THE MONEY MACHINE — a validly-SIGNED checkout.session.completed is
         posted to booking-webhook (see WHY SIMULATED below); we then VERIFY IN
         THE DATABASE that the pending row flipped to 'paid', keyed to the
         booking_id, at the right price, with paid_at + stripe_payment_id set;
         re-post the same event and assert idempotency (still one paid row, no
         second flip); a tampered signature is refused (fail-closed); finally
         booking-status returns 'paid' for the (bid, session_id) pair — the
         exact read /booked polls before it ever says "BOOKED".

   WHAT IT DOES **NOT** COVER (honest — no faked coverage):
     · Typing card 4242 into Stripe's embedded iframe + Stripe actually
       charging. The browser mount (Stripe's card iframe rendering INSIDE our
       /book panel) is proven separately in the walkthrough screenshots, and
       needs VITE_BOOKINGS_STRIPE_PUBLISHABLE_KEY on the preview build; typing
       into the cross-origin iframe is brittle, so the charge stays simulated
       in test B — same boundary v19 drew for tickets.
     · Stripe's REAL webhook DELIVERY. Stripe only delivers to an endpoint it
       reaches itself (stripe listen / a dashboard endpoint). The Stripe CLI is
       absent in headless/CI, so we SIMULATE the event with a valid signature —
       this exercises 100% of OUR webhook code (verify → flip → idempotency →
       200), but not Stripe's delivery pipeline or the card UI.

   REQUIRES (the money half talks to the BOOKING Stripe account, which is TEST):
     SUPABASE_URL                 project url (defaults to the known ref)
     SUPABASE_SERVICE_KEY         service role — make QA fixtures, verify, purge
     BOOKINGS_STRIPE_WEBHOOK_SECRET   the booking webhook secret (sign==verify).
                                  Lives ONLY in Supabase secrets (not readable
                                  back) — export it by hand to run test B:
                                    export BOOKINGS_STRIPE_WEBHOOK_SECRET=whsec_…
     FUNCTIONS_URL                edge base (defaults to the known ref's /functions/v1)
   Missing SERVICE_KEY → the whole group SKIPS. Missing the webhook secret →
   only test B skips (visible skip, never a false green). Test A needs no secret
   beyond the service key + the deployed function.

   INTEGRITY: preview and prod share ONE Supabase, and QA fixtures (a creative
   profile, a live service listing, the bookings rows) land in that shared DB.
   So every artifact is namespaced by RUN and PURGED in afterAll, which then
   asserts ZERO residual rows. is_demo=false on the QA creative is deliberate —
   the fn REJECTS demo identities (guardrail 4), so the QA creative must be a
   real (if throwaway) profile to exercise the true path.
   ========================================================================= */

const SUPA_URL = process.env.SUPABASE_URL || 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const WEBHOOK_SECRET = process.env.BOOKINGS_STRIPE_WEBHOOK_SECRET || ''
const FUNCTIONS_URL =
  process.env.FUNCTIONS_URL || 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co/functions/v1'

const envOk = Boolean(SERVICE_KEY)

// A stable, run-unique namespace so teardown can purge PRECISELY and prove it.
const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
const PAYMENT_ID = `pi_c4qa_booking_${RUN}`
const CLIENT_EMAIL = `c4-qa-booking-${RUN}@example.com`
const CLIENT_NAME = 'QA Booking Client'
const CREATIVE_EMAIL = `c4-qa-creative-${RUN}@example.com`
const CREATIVE_NAME = 'QA Creative'
const SERVICE_TITLE = `QA Service — ${RUN}`
const PRICE_CENTS = 4200

// service client (bypasses RLS) — only ever with the service key present
const admin = envOk ? createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } }) : null
// stripe instance only for its signer; generateTestHeaderString signs with the
// webhook secret, NOT this key — a placeholder is fine when the account key is absent
const stripe = new Stripe(process.env.BOOKINGS_STRIPE_SECRET_KEY || 'sk_test_placeholder_for_signer')

// module state shared across the serial story
const S = { creativeId: null, listingId: null, bid: null, sessionId: null }

/** Build a signed checkout.session.completed exactly as booking-webhook reads it. */
function signedBookingCompleted({ sessionId, paymentId, bookingId, listingId, creativeId, amount }) {
  const event = {
    id: `evt_c4qa_${RUN}`,
    object: 'event',
    api_version: '2024-06-20',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_intent: paymentId, // webhook prefers this as stripe_payment_id
        payment_status: 'paid', // synchronous card payment: money captured
        amount_total: amount,
        currency: 'usd',
        metadata: {
          kind: 'booking',
          booking_id: bookingId,
          listing_id: listingId,
          creative_id: creativeId,
          price_cents: String(amount),
          fee_bps: '1500',
          client_name: CLIENT_NAME,
        },
      },
    },
  }
  const payload = JSON.stringify(event)
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET })
  return { payload, header }
}

test.describe('v21 · the booking machine, end to end', () => {
  test.skip(!envOk, 'needs SUPABASE_SERVICE_KEY — see file header. Skipping instead of faking a pass.')
  test.describe.configure({ mode: 'serial' })
  test.use({ colorScheme: 'dark' })

  test.beforeAll(async () => {
    // The QA creative must be a REAL auth user: booking-webhook looks up their
    // email via getUserById(creative_id), and the profile row keys on it.
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: CREATIVE_EMAIL, password: `QaCreative!${RUN}`, email_confirm: true,
      user_metadata: { full_name: CREATIVE_NAME },
    })
    expect(cErr, 'QA creative auth user creation must succeed').toBeFalsy()
    S.creativeId = created.user.id

    // profiles keys on user_id (text); id is the profile PK the listing/booking
    // reference and the webhook's getUserById expects — set both to the uid.
    const { error: pErr } = await admin.from('profiles').insert({
      id: S.creativeId,
      user_id: String(S.creativeId),
      username: `qa_creative_${RUN}`.slice(0, 30),
      full_name: CREATIVE_NAME,
      is_demo: false, // guardrail 4: the fn rejects demo identities
    })
    expect(pErr, `QA creative profile insert must succeed: ${pErr?.message}`).toBeFalsy()

    // a LIVE service listing — the thing being booked
    const { data: listing, error: lErr } = await admin.from('listings').insert({
      profile_id: S.creativeId,
      kind: 'service',
      title: SERVICE_TITLE,
      description: 'QA-only service listing — never a real sellable offer.',
      price_cents: PRICE_CENTS,
      currency: 'usd',
      status: 'live',
      delivery: 'QA delivery',
    }).select('id').single()
    expect(lErr, `QA listing insert must succeed: ${lErr?.message}`).toBeFalsy()
    S.listingId = listing.id
  })

  test('A · create-booking-session: embedded switch (clientSecret, no hosted URL) + a pending row born + hosted still works', async ({ request }) => {
    // ---- A1 · the EMBEDDED session, proven on the real function ----
    const embedded = await request.post(`${FUNCTIONS_URL}/create-booking-session`, {
      headers: { 'content-type': 'application/json' },
      data: {
        listingId: S.listingId,
        agreed: true,
        client: { name: CLIENT_NAME, email: CLIENT_EMAIL },
        request: { brief: 'QA brief — the work order', date: 'a date', place: 'Houston', links: '' },
        embedded: true,
      },
    })
    expect(embedded.status(), 'create-booking-session must answer 200 (real fn, booking TEST key)').toBe(200)
    const eBody = await embedded.json()
    expect(eBody.clientSecret, 'embedded booking must return a clientSecret to mount in-app').toBeTruthy()
    expect(String(eBody.clientSecret), 'the clientSecret must be a real embedded session secret').toContain('_secret_')
    expect(eBody.url, 'embedded must NOT return a hosted checkout.stripe.com URL').toBeFalsy()
    expect(eBody.bid, 'embedded must return the booking id so /booked can poll').toBeTruthy()
    S.bid = eBody.bid
    // the session id is the clientSecret prefix (cs_..._secret_...) — the same
    // id booking-status keys on and the webhook event carries.
    S.sessionId = String(eBody.clientSecret).split('_secret_')[0]
    expect(S.sessionId.startsWith('cs_'), 'the derived session id must be a checkout session id').toBe(true)

    // the ROW is born BEFORE the money moves — pending, right price, right parties
    const { data: born, error: bErr } = await admin
      .from('bookings').select('*').eq('id', S.bid).single()
    expect(bErr, 'the pending booking row must exist').toBeFalsy()
    expect(born.status, 'a booking is born pending — money has not moved yet').toBe('pending')
    expect(Number(born.price_cents), 'the row must record the DB price in cents').toBe(PRICE_CENTS)
    expect(born.creative_id, 'the row must belong to the creative being paid').toBe(S.creativeId)
    expect(born.listing_id, 'the row must reference the service listing').toBe(S.listingId)
    expect(born.client_email, 'the client email must persist').toBe(CLIENT_EMAIL)
    expect(born.stripe_session_id, 'the row must record its Stripe session id').toBe(S.sessionId)

    // ---- A2 · backward-compat: NO flag still returns a hosted URL ----
    // The additive contract that keeps current prod booking alive until the
    // frontend merges — this is the baseline that was green on the OLD flow.
    const hosted = await request.post(`${FUNCTIONS_URL}/create-booking-session`, {
      headers: { 'content-type': 'application/json' },
      data: {
        listingId: S.listingId,
        agreed: true,
        client: { name: CLIENT_NAME, email: CLIENT_EMAIL },
        request: { brief: 'QA brief — hosted path', date: '', place: '', links: '' },
      },
    })
    expect(hosted.status(), 'the default (no-flag) call must still answer 200').toBe(200)
    const hBody = await hosted.json()
    expect(hBody.url, 'the default call must still return a hosted checkout.stripe.com URL (backward compat)').toBeTruthy()
    expect(String(hBody.url), 'the hosted URL must point at Stripe checkout').toContain('checkout.stripe.com')
    expect(hBody.clientSecret, 'the default call must NOT return a clientSecret').toBeFalsy()
    // purge the extra pending row this hosted probe created (namespaced cleanup
    // catches it too, but delete it precisely so afterAll's zero-residual holds)
    await admin.from('bookings').delete().eq('creative_id', S.creativeId).neq('id', S.bid)
  })

  test('B · booking-webhook → the pending row flips to paid → booking-status confirms', async ({ request }) => {
    test.skip(!WEBHOOK_SECRET, 'needs BOOKINGS_STRIPE_WEBHOOK_SECRET (Supabase secret, export by hand) — skipping the money half instead of faking it.')

    // ---- 1 · the payment lands: a validly-signed completed event ----
    const { payload, header } = signedBookingCompleted({
      sessionId: S.sessionId, paymentId: PAYMENT_ID, bookingId: S.bid,
      listingId: S.listingId, creativeId: S.creativeId, amount: PRICE_CENTS,
    })
    const hook = await request.post(`${FUNCTIONS_URL}/booking-webhook`, {
      headers: { 'stripe-signature': header, 'content-type': 'application/json' },
      data: payload,
    })
    expect(hook.status(), 'a validly-signed webhook must be accepted').toBe(200)
    expect((await hook.json()).received, 'webhook must ack received').toBe(true)

    // ---- 2 · VERIFY IN THE DB: the row flipped to paid, honestly ----
    const { data: paid, error: qErr } = await admin
      .from('bookings').select('*').eq('id', S.bid).single()
    expect(qErr, 'booking lookup must succeed').toBeFalsy()
    expect(paid.status, 'the booking must be paid after the webhook').toBe('paid')
    expect(paid.paid_at, 'paid_at must be stamped').toBeTruthy()
    expect(paid.stripe_payment_id, 'the payment id must be recorded').toBe(PAYMENT_ID)
    expect(Number(paid.price_cents), 'the amount must be unchanged').toBe(PRICE_CENTS)
    expect(paid.creative_id, 'the paid booking must still belong to the creative').toBe(S.creativeId)

    // ---- 3 · idempotency: Stripe delivers AT-LEAST-ONCE; a re-post is a no-op ----
    const retry = await request.post(`${FUNCTIONS_URL}/booking-webhook`, {
      headers: { 'stripe-signature': header, 'content-type': 'application/json' },
      data: payload,
    })
    expect(retry.status(), 'a duplicate delivery must still ack 200').toBe(200)
    const { data: afterRetry } = await admin
      .from('bookings').select('id, paid_at').eq('id', S.bid).single()
    expect(afterRetry.paid_at, 'a duplicate webhook must NOT re-stamp paid_at').toBe(paid.paid_at)

    // ---- 4 · a tampered signature is refused (fail-closed) ----
    const bad = await request.post(`${FUNCTIONS_URL}/booking-webhook`, {
      headers: { 'stripe-signature': header + 'ff', 'content-type': 'application/json' },
      data: payload,
    })
    expect(bad.status(), 'an invalid signature must be rejected').toBe(400)

    // ---- 5 · booking-status returns paid for the (bid, session_id) pair ----
    // The exact read /booked polls before it ever renders "BOOKED".
    const status = await request.get(
      `${FUNCTIONS_URL}/booking-status?bid=${encodeURIComponent(S.bid)}&session_id=${encodeURIComponent(S.sessionId)}`,
    )
    expect(status.status(), 'booking-status must answer 200 for a real pair').toBe(200)
    const sBody = await status.json()
    expect(sBody.status, 'booking-status must report paid').toBe('paid')
    expect(sBody.service_title, 'booking-status must carry the service title').toBe(SERVICE_TITLE)
    expect(Number(sBody.price_cents), 'booking-status must carry the price').toBe(PRICE_CENTS)
    expect(sBody.creative_name, 'booking-status must carry the creative name').toBe(CREATIVE_NAME)
  })

  test.afterAll(async () => {
    if (!admin) return
    // Purge every QA artifact, keyed on the run namespace, and PROVE zero residual.
    if (S.creativeId) {
      await admin.from('bookings').delete().eq('creative_id', S.creativeId)
      await admin.from('listings').delete().eq('profile_id', S.creativeId)
      await admin.from('profile_tastes').delete().eq('profile_id', S.creativeId)
      await admin.from('profiles').delete().eq('id', S.creativeId)
      await admin.auth.admin.deleteUser(S.creativeId).catch(() => {})
    }
    const { data: residual } = await admin
      .from('bookings').select('id').eq('creative_id', S.creativeId || '00000000-0000-0000-0000-000000000000')
    expect(residual?.length ?? 0, 'teardown must leave ZERO residual QA bookings').toBe(0)
    // NOTE: the unpaid Stripe TEST checkout sessions from test A expire on their
    // own — a test-mode session that never became a payment moves no money and
    // cannot be deleted via the API. It is not residual DB state.
  })
})
