// @ts-check
import { test, expect } from '@playwright/test'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

/* =========================================================================
   THE PURCHASE WALKTHROUGH (v19 · LA RED DE SEGURIDAD) — the gate for the one
   machine that moves money and, until now, had no automatic proof: buying a
   ticket. Every other walkthrough stops at checkout.stripe.com; this one rides
   the whole chain to a real ticket ROW that belongs to the buyer.

   WHAT IT COVERS (against REAL api/ code on the target deploy — api/ is the v20
   EMBEDDED checkout now, no longer the hosted-URL flow):
     A · the EMBEDDED server switch + intent stays in-app. A1: the real
         create-checkout-session, hit on the TEST key, must answer 200 with a
         clientSecret and NO checkout.stripe.com URL — the proof the fn moved
         from ui_mode:hosted → 'embedded' (v20). A2: a buyer sent to
         /auth?mode=create&next=… (the exact ?next mechanism EventLanding relies
         on) authenticates, lands back on their destination, and the internal QA
         UI (/test-purchase — the ONLY surface that reaches the is_test QA event;
         the public EventPage filters is_test=false, by design) hands off to our
         OWN /checkout surface — the buyer never bounces to checkout.stripe.com.
         (Driving Stripe's card iframe is cross-origin/brittle and needs
         VITE_STRIPE_PUBLISHABLE_KEY on the preview, so it stays out of scope —
         same boundary the hosted flow drew at the redirect.)
     B · the money machine — a validly-SIGNED checkout.session.completed is
         posted to /api/webhook (see WHY SIMULATED below); we then VERIFY IN THE
         DATABASE that exactly one confirmed ticket exists, keyed to the buyer
         (buyer_id) and the event, at the right price/tier; re-post the same
         event and assert idempotency (no duplicate); finally /claim confirms
         "YOU'RE IN" — and ClaimWorld only ever says that against a real row.

   WHAT IT DOES **NOT** COVER (honest, per the send-off — no faked coverage):
     · Stripe's EMBEDDED card iframe rendering + typing card 4242 + Stripe
       actually charging. The iframe is cross-origin/brittle and needs
       VITE_STRIPE_PUBLISHABLE_KEY on the preview build; we assert the embedded
       session (clientSecret) is created and that the buyer lands on our own
       /checkout, and stop there.
     · Stripe's REAL webhook DELIVERY. Stripe can only deliver to a public
       endpoint it reaches itself (via `stripe listen`/`stripe trigger`, or a
       dashboard test endpoint). The Stripe CLI is not present in CI/headless,
       so we SIMULATE the event with a valid signature — this exercises 100% of
       OUR webhook code (signature verify → insert → idempotency → 200), but
       NOT Stripe's delivery pipeline or the card UI. Those stay a manual /
       stripe-CLI step, documented in the handback.

   REQUIRES (target = a Vercel PREVIEW deploy, whose Stripe key is TEST — prod
   is LIVE, never run this there):
     PREVIEW_URL            the preview base (playwright.config baseURL)
     STRIPE_WEBHOOK_SECRET  the PREVIEW webhook secret (sign == verify)
     SUPABASE_URL           the project url (defaults to the known ref)
     SUPABASE_SERVICE_KEY   service role — create the QA user, verify + purge
   Pull them with:  vercel env pull --environment=preview .env.preview
   then export them into the run. Missing any → the group SKIPS (a visible skip,
   never a false green).

   INTEGRITY: there is no is_demo flag on `tickets`, and the QA ticket lands in
   the SHARED prod DB (preview and prod point at one Supabase). So every QA
   artifact is namespaced by run and PURGED in afterAll, which then asserts ZERO
   residual rows. The QA event itself is the permanent, RLS-hidden
   `qa-checkout-test` (migration 0012) — never a real sellable event.
   ========================================================================= */

const SUPA_URL = process.env.SUPABASE_URL || 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''
const QA_EVENT_SLUG = 'qa-checkout-test'
const QA_TIER = 'test'

const envOk = Boolean(SERVICE_KEY && WEBHOOK_SECRET)

// A stable, run-unique namespace so teardown can purge PRECISELY and prove it.
const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
const PAYMENT_ID = `pi_c4qa_purchase_${RUN}`     // webhook dedup key → cleanup key
const SESSION_ID = `cs_c4qa_purchase_${RUN}`
const BUYER_EMAIL = `c4-qa-purchase-${RUN}@example.com`
const BUYER_PASS = `QaPurchase!${RUN}`
const BUYER_NAME = 'QA Purchase'

// service client (bypasses RLS) — only ever with the service key present
const admin = envOk ? createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } }) : null
// stripe instance only for its signer; the key is NOT used to sign (the secret is)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_for_signer')

// module state shared across the serial story
const S = { uid: null, eventId: null, price: null, tierName: null, clientSecret: null }

/** Build a signed checkout.session.completed exactly as webhook.js reads it. */
function signedCompletedEvent({ sessionId, paymentId, eventId, uid, email, name, amount, tier, tierName }) {
  const event = {
    id: `evt_c4qa_${RUN}`,
    object: 'event',
    api_version: '2024-06-20',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_intent: paymentId,      // webhook prefers this as the dedup key
        amount_total: amount,
        currency: 'usd',
        customer_email: email,
        customer_details: { email, name },
        metadata: {
          event_id: eventId,
          event_slug: QA_EVENT_SLUG,
          tier,
          tier_name: tierName,
          amount: String(amount),
          user_name: name,
          user_id: uid,
        },
      },
    },
  }
  const payload = JSON.stringify(event)
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET })
  return { payload, header }
}

test.describe('v19 · the purchase machine, end to end', () => {
  test.skip(!envOk, 'needs SUPABASE_SERVICE_KEY + STRIPE_WEBHOOK_SECRET (preview) — see file header. Skipping instead of faking a pass.')
  test.describe.configure({ mode: 'serial' })
  test.use({ colorScheme: 'dark' })

  test.beforeAll(async () => {
    // Resolve the permanent hidden QA event authoritatively (service key).
    const { data: ev, error: evErr } = await admin
      .from('events').select('id, tiers, is_test').eq('slug', QA_EVENT_SLUG).single()
    expect(evErr, `QA event '${QA_EVENT_SLUG}' must resolve — apply migration 0012`).toBeFalsy()
    expect(ev?.is_test, 'the QA event MUST be is_test — never run purchase QA against a real event').toBe(true)
    const tier = (ev.tiers || []).find((t) => t.id === QA_TIER)
    expect(tier, `QA event must carry the '${QA_TIER}' tier`).toBeTruthy()
    S.eventId = ev.id
    S.price = tier.price
    S.tierName = tier.name

    // Create the QA buyer (email pre-confirmed so UI sign-in needs no inbox).
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: BUYER_EMAIL, password: BUYER_PASS, email_confirm: true,
      user_metadata: { full_name: BUYER_NAME },
    })
    expect(cErr, 'QA buyer creation must succeed').toBeFalsy()
    S.uid = created.user.id
  })

  test('A · the frozen fn creates an EMBEDDED session (clientSecret, no hosted URL) + intent stays in-app', async ({ page, request }) => {
    // ---- A1 · the embedded server switch, proven deterministically ----
    // The SAME frozen create-checkout-session, hit directly on the TEST key,
    // must now answer an EMBEDDED session: a clientSecret to mount in-app and
    // NO checkout.stripe.com URL. This is the money-machine half of v20 — it
    // needs no browser and no publishable key, so it is the trustworthy proof
    // that the fn moved from hosted → embedded. (userId is required by the fn;
    // the QA buyer from beforeAll supplies a real one.)
    const create = await request.post('/api/create-checkout-session', {
      headers: { 'content-type': 'application/json' },
      data: { eventSlug: QA_EVENT_SLUG, tier: QA_TIER, email: BUYER_EMAIL, userName: BUYER_NAME, userId: S.uid },
    })
    expect(create.status(), 'create-checkout-session must answer 200 (frozen fn + Stripe TEST key)').toBe(200)
    const body = await create.json()
    expect(body.clientSecret, 'embedded checkout must return a clientSecret to mount in-app').toBeTruthy()
    expect(String(body.clientSecret), 'the clientSecret must be a real embedded session secret').toContain('_secret_')
    expect(body.url, 'embedded must NOT return a hosted checkout.stripe.com URL').toBeFalsy()
    expect(body.sessionId, 'checkout must still return a session id').toBeTruthy()
    S.clientSecret = body.clientSecret

    // ---- A2 · intent survives the door AND the buyer stays IN the app ----
    // The EXACT ?next mechanism EventLanding relies on: the join door opens on
    // Create Account (mode=create); ?next returns the buyer to their intended
    // destination after auth. Then the QA UI hands off to our OWN /checkout —
    // NOT a bounce to checkout.stripe.com. That in-app handoff is the whole
    // point of v20, so we assert the URL that results is ours.
    await page.goto('/auth?mode=create&next=%2Ftest-purchase')
    await expect(page.getByPlaceholder('First name'), 'mode=create must open the create form').toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Sign In' }).last().click()
    await page.getByPlaceholder('Email').fill(BUYER_EMAIL)
    await page.getByPlaceholder('Password').fill(BUYER_PASS)
    await page.getByRole('button', { name: 'Sign In' }).last().click()

    await page.waitForURL('**/test-purchase', { timeout: 25000 })
    expect(page.url(), 'the buyer must return to their intended destination (?next preserved)').toContain('/test-purchase')

    // a first-run onboarding coachmark can overlay the page and intercept the
    // click — clear it, then force the click as belt-and-suspenders
    await page.waitForTimeout(1200)
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /RUN TEST CHECKOUT/i }).click({ force: true })
    // the QA UI navigates to our in-app checkout surface, carrying the event +
    // tier — the buyer never leaves the app for checkout.stripe.com.
    await page.waitForURL('**/checkout**', { timeout: 20000 })
    expect(page.url(), 'the buyer must land on OUR /checkout, not Stripe’s domain').toContain('/checkout')
    expect(page.url(), 'the checkout surface must carry the QA event slug').toContain('slug=qa-checkout-test')
    expect(page.url(), 'the buyer must NOT be bounced to checkout.stripe.com').not.toContain('stripe.com')
    // We deliberately do NOT drive the Stripe card iframe (cross-origin/brittle,
    // and it needs VITE_STRIPE_PUBLISHABLE_KEY on the preview). The embedded
    // SESSION is proven in A1; the payment itself is simulated in test B.
  })

  test('B · webhook → a real confirmed ticket that belongs to the buyer → /claim', async ({ page, request }) => {
    // ---- 1 · the payment lands: a validly-signed completed event ----
    const { payload, header } = signedCompletedEvent({
      sessionId: SESSION_ID, paymentId: PAYMENT_ID, eventId: S.eventId,
      uid: S.uid, email: BUYER_EMAIL, name: BUYER_NAME, amount: S.price,
      tier: QA_TIER, tierName: S.tierName,
    })
    const hook = await request.post('/api/webhook', {
      headers: { 'stripe-signature': header, 'content-type': 'application/json' },
      data: payload,
    })
    expect(hook.status(), 'a validly-signed webhook must be accepted').toBe(200)
    expect((await hook.json()).received, 'webhook must ack received').toBe(true)

    // ---- 2 · VERIFY IN THE DB: the ticket exists AND belongs to the buyer ----
    const { data: rows, error: qErr } = await admin
      .from('tickets').select('*').eq('stripe_payment_id', PAYMENT_ID)
    expect(qErr, 'ticket lookup must succeed').toBeFalsy()
    expect(rows.length, 'exactly one ticket must be created for this payment').toBe(1)
    const tk = rows[0]
    expect(tk.buyer_id, 'the ticket must belong to the buyer who paid').toBe(S.uid)
    expect(tk.event_id, 'the ticket must be tied to the QA event').toBe(S.eventId)
    expect(tk.status, 'the ticket must be confirmed').toBe('confirmed')
    expect(tk.tier_id, 'the ticket must record the tier bought').toBe(QA_TIER)
    expect(Number(tk.price_paid), 'the ticket must record the amount paid (cents)').toBe(S.price)
    expect(tk.buyer_email, 'the buyer email must persist').toBe(BUYER_EMAIL)
    expect(tk.qr_code, 'a QR code must be minted').toBeTruthy()

    // ---- 3 · idempotency: Stripe delivers AT-LEAST-ONCE; a re-post is a no-op ----
    const retry = await request.post('/api/webhook', {
      headers: { 'stripe-signature': header, 'content-type': 'application/json' },
      data: payload,
    })
    expect(retry.status(), 'a duplicate delivery must still ack 200').toBe(200)
    const { data: afterRetry } = await admin
      .from('tickets').select('id').eq('stripe_payment_id', PAYMENT_ID)
    expect(afterRetry.length, 'a duplicate webhook must NOT create a second ticket').toBe(1)

    // ---- 4 · a tampered signature is refused (fail-closed) ----
    const bad = await request.post('/api/webhook', {
      headers: { 'stripe-signature': header + 'ff', 'content-type': 'application/json' },
      data: payload,
    })
    expect(bad.status(), 'an invalid signature must be rejected').toBe(400)

    // ---- 5 · /claim confirms — but only against the REAL row ----
    // Sign the buyer in (fresh page session), then land on the retention bridge.
    await page.goto('/auth')
    await page.getByPlaceholder('Email').fill(BUYER_EMAIL)
    await page.getByPlaceholder('Password').fill(BUYER_PASS)
    await page.getByRole('button', { name: 'Sign In' }).last().click()
    await page.waitForURL('**/', { timeout: 25000 })

    await page.goto(`/claim?session_id=${SESSION_ID}`)
    await expect(page.getByText(/YOU'RE IN/i), 'ClaimWorld must confirm the real ticket').toBeVisible({ timeout: 25000 })
    await expect(page.getByText(tk.qr_code), 'the confirmed ticket chip must show the real QR').toBeVisible({ timeout: 10000 })
  })

  test.afterAll(async () => {
    if (!admin) return
    // Purge every QA artifact, keyed on the run namespace, and PROVE zero residual.
    await admin.from('tickets').delete().eq('stripe_payment_id', PAYMENT_ID)
    if (S.uid) {
      await admin.from('profile_tastes').delete().eq('profile_id', S.uid)
      await admin.from('profiles').delete().eq('id', S.uid)
      await admin.auth.admin.deleteUser(S.uid).catch(() => {})
    }
    const { data: residual } = await admin
      .from('tickets').select('id').eq('stripe_payment_id', PAYMENT_ID)
    expect(residual?.length ?? 0, 'teardown must leave ZERO residual QA tickets').toBe(0)
    // NOTE: the unpaid Stripe TEST checkout session from test A is left to
    // expire on its own — a test-mode session that never became a payment moves
    // no money and cannot be deleted via the API. It is not residual DB state.
  })
})
