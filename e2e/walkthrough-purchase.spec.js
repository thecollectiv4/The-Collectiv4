// @ts-check
import { test, expect } from '@playwright/test'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

/* =========================================================================
   THE PURCHASE WALKTHROUGH (v19 · LA RED DE SEGURIDAD) — the gate for the one
   machine that moves money and, until now, had no automatic proof: buying a
   ticket. Every other walkthrough stops at checkout.stripe.com; this one rides
   the whole chain to a real ticket ROW that belongs to the buyer.

   WHAT IT COVERS (all against REAL, FROZEN api/ code on the target deploy):
     A · intent survives the door — a buyer sent to /auth?mode=create&next=…
         (the exact ?next mechanism EventLanding relies on) authenticates and
         lands back on their intended destination. Then the internal QA checkout
         UI (/test-purchase — the ONLY surface that reaches the is_test QA event;
         the public EventPage filters is_test=false, by design) fires the real
         create-checkout-session, which must answer 200 with a live
         checkout.stripe.com URL — proof the checkout fn + the Stripe TEST key
         work end to end. (The resume-checkout-on-a-public-event variant needs a
         real published event with an available tier and is out of scope here.)
     B · the money machine — a validly-SIGNED checkout.session.completed is
         posted to /api/webhook (see WHY SIMULATED below); we then VERIFY IN THE
         DATABASE that exactly one confirmed ticket exists, keyed to the buyer
         (buyer_id) and the event, at the right price/tier; re-post the same
         event and assert idempotency (no duplicate); finally /claim confirms
         "YOU'RE IN" — and ClaimWorld only ever says that against a real row.

   WHAT IT DOES **NOT** COVER (honest, per the send-off — no faked coverage):
     · Stripe's HOSTED checkout page rendering + typing card 4242 + Stripe
       actually charging. Driving checkout.stripe.com is cross-origin and
       brittle; we assert the session/URL is created and stop there.
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
const S = { uid: null, eventId: null, price: null, tierName: null, sessionUrl: null }

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

  test('A · intent survives the door (?next) → the QA UI creates a real Stripe test checkout', async ({ page }) => {
    // --- intent: the EXACT ?next mechanism EventLanding relies on. The join
    // door opens on Create Account (mode=create); ?next carries the buyer's
    // destination through the door and must return them to it after auth. ---
    await page.goto('/auth?mode=create&next=%2Ftest-purchase')
    await expect(page.getByPlaceholder('First name'), 'mode=create must open the create form').toBeVisible({ timeout: 15000 })
    // this buyer already exists (beforeAll) → switch to Sign In and authenticate
    await page.getByRole('button', { name: 'Sign In' }).last().click()
    await page.getByPlaceholder('Email').fill(BUYER_EMAIL)
    await page.getByPlaceholder('Password').fill(BUYER_PASS)
    await page.getByRole('button', { name: 'Sign In' }).last().click()

    // ?next honored → the buyer returns to EXACTLY where they intended
    await page.waitForURL('**/test-purchase', { timeout: 25000 })
    expect(page.url(), 'the buyer must return to their intended destination (?next preserved)').toContain('/test-purchase')

    // a first-run onboarding coachmark can overlay the page and intercept the
    // click — clear it, then force the click as belt-and-suspenders
    await page.waitForTimeout(1200)
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(500)

    // --- checkout: the internal QA UI fires the REAL frozen fn on the TEST key.
    // /test-purchase is the only surface that reaches the is_test QA event. ---
    // We CAPTURE the checkout response inside a route handler — reading the body
    // there, before the page does window.location.href=<stripe url> and tears
    // down the network resource (a plain waitForResponse().json() races the
    // unload and fails). The Stripe redirect itself is aborted so the page stays.
    let checkoutStatus = null
    let checkoutBody = null
    await page.route('**/api/create-checkout-session', async (route) => {
      const response = await route.fetch()
      checkoutStatus = response.status()
      const text = await response.text()
      try { checkoutBody = JSON.parse(text) } catch { /* leave null */ }
      await route.fulfill({ response, body: text })
    })
    await page.route(/checkout\.stripe\.com/, (route) => route.abort())
    await page.getByRole('button', { name: /RUN TEST CHECKOUT/i }).click({ force: true })
    await expect.poll(() => checkoutBody, { message: 'create-checkout-session never answered', timeout: 30000 }).toBeTruthy()
    expect(checkoutStatus, 'create-checkout-session must answer 200 (frozen fn + Stripe TEST key)').toBe(200)
    expect(checkoutBody.url, 'checkout must return a live Stripe URL').toContain('checkout.stripe.com')
    expect(checkoutBody.sessionId, 'checkout must return a session id').toBeTruthy()
    S.sessionUrl = checkoutBody.url
    // We deliberately do NOT drive checkout.stripe.com (cross-origin/brittle) —
    // the handoff is proven; the payment itself is simulated in test B.
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
