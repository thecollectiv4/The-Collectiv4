import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { getStripe } from '@/lib/stripe'
import { Loader2, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react'

/* =========================================================================
   CheckoutEmbedded — v20 · EL PAGO EN CASA. The card form now lives INSIDE
   the app, on our domain, dressed in Cosmos — never a bounce to
   checkout.stripe.com at the exact moment the buyer reaches for their card.

   It is a standalone route (like /claim, /book): it renders transparent over
   the shared sky (App.jsx mounts Atmosphere above the router), so the ceremony
   keeps the room's atmosphere instead of a flat void.

   THE FLOW
     1. Gate on auth — checkout requires a logged-in buyer (the ticket must be
        owner-readable under RLS). No session → send to the join door, ?next
        carries them straight back here.
     2. Create the session — POST the SAME frozen create-checkout-session with
        the same body; it now answers a clientSecret (ui_mode:'embedded').
     3. Mount Stripe Embedded Checkout into our framed panel. Stripe renders
        the card fields (+ Apple/Google Pay once the domain is verified) in an
        iframe it controls; everything AROUND it is ours.
     4. On completion Stripe redirects the top window to return_url = /claim —
        the unchanged retention bridge that polls the DB for the real ticket
        the webhook writes. The webhook stays the single source of truth.

   HONEST STATES (Ley 11 — never a mute screen): loading while the session is
   built + Stripe loads; a real error (session refused, key missing, form
   failed) with a way back; card declines surface INSIDE Stripe's own form.
   The "back / changed my mind" path is the control below — it returns to the
   event with the tier intact, the only actionable moment for an open session
   on a card+wallet checkout.
   ========================================================================= */

const VOID = 'var(--bg)'
const BONE = 'var(--cream)'
const BONE_MID = 'var(--cream-mid)'
const BONE_LOW = 'var(--cream-low)'
const SILVER = 'var(--silver)'
const HAIR = 'rgba(var(--ink-rgb),.14)'

export default function CheckoutEmbedded() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const slug = searchParams.get('slug') || ''
  const tier = searchParams.get('tier') || ''
  const from = searchParams.get('from') || ''

  // phase: loading | ready | error
  const [phase, setPhase] = useState('loading')
  const [error, setError] = useState('')
  const [display, setDisplay] = useState(null) // { title, edition, tierName, price }
  const mountRef = useRef(null)

  // Header info (non-blocking, cosmetic). The card mount never waits on it.
  useEffect(() => {
    if (!slug) return
    let alive = true
    supabase.from('events').select('title, edition, tiers').eq('slug', slug).maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return
        const t = (data.tiers || []).find((x) => x.id === tier)
        setDisplay({ title: data.title, edition: data.edition, tierName: t?.name || '', price: t?.price ?? null })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [slug, tier])

  // Create the session + mount embedded checkout.
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      const here = `${location.pathname}${location.search}`
      navigate(`/auth?mode=create&next=${encodeURIComponent(here)}`)
      return
    }
    if (!slug || !tier) { setError('This checkout link is missing its event or ticket.'); setPhase('error'); return }

    let cancelled = false
    let checkout = null

    async function run() {
      setPhase('loading'); setError('')

      const stripePromise = getStripe()
      if (!stripePromise) {
        setError('Payments aren’t available right now. Try again shortly or DM @thecollectiv4.')
        setPhase('error'); return
      }

      // 1 · the session (the SAME frozen fn, now embedded → clientSecret)
      let clientSecret
      try {
        const res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventSlug: slug,
            tier,
            email: user.email,
            userName: user.user_metadata?.full_name || '',
            userId: user.id,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.clientSecret) throw new Error(data.error || 'We couldn’t start your checkout.')
        clientSecret = data.clientSecret
      } catch (e) {
        if (!cancelled) { setError(e?.message || 'Connection error. Try again.'); setPhase('error') }
        return
      }
      if (cancelled) return

      // 2 · Stripe.js + the embedded instance
      let stripe
      try {
        stripe = await stripePromise
      } catch {
        if (!cancelled) { setError('Payments aren’t available right now. Try again shortly.'); setPhase('error') }
        return
      }
      if (!stripe || cancelled) { if (!cancelled) { setError('Payments aren’t available right now.'); setPhase('error') } return }

      try {
        // API name moved across Stripe.js versions. On this account's version
        // stripe.initEmbeddedCheckout STILL EXISTS but THROWS "has been removed —
        // use createEmbeddedCheckoutPage()". So prefer createEmbeddedCheckoutPage
        // and only fall back to the legacy name for older Stripe.js.
        const initEmbedded = stripe.createEmbeddedCheckoutPage || stripe.initEmbeddedCheckout
        checkout = await initEmbedded.call(stripe, { clientSecret })
        if (cancelled) { try { checkout.destroy() } catch { /* noop */ } return }
        if (!mountRef.current) { try { checkout.destroy() } catch { /* noop */ } return }
        checkout.mount(mountRef.current)
        setPhase('ready')
      } catch {
        if (!cancelled) { setError('We couldn’t load the payment form. Try again.'); setPhase('error') }
      }
    }

    run()
    return () => { cancelled = true; if (checkout) { try { checkout.destroy() } catch { /* noop */ } } }
    // Key on user?.id, NOT the whole `user` object. AuthContext replaces the
    // user object on every onAuthStateChange (incl. TOKEN_REFRESHED, which fires
    // on the autoRefresh tick + tab refocus). Keying on the object reference
    // would tear down the mounted Stripe form and spawn a fresh session mid
    // card-entry — wiping what the buyer typed. The id is stable across refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, slug, tier])

  const goBack = () => {
    // Back = the open-session path: return to the event with the tier intact
    // AND the "no charge was made" reassurance (the banner that used to fire on
    // the hosted cancel_url). `from` is already decoded by useSearchParams — do
    // NOT decode again. Accept ONLY an internal path (single leading slash,
    // never //host or an absolute URL) so a crafted link can't redirect away.
    const safeFrom = from && from.startsWith('/') && !from.startsWith('//') ? from : (slug ? `/e/${slug}` : '/')
    const sep = safeFrom.includes('?') ? '&' : '?'
    navigate(`${safeFrom}${sep}ticket=cancelled`)
  }

  const priceLabel = display && typeof display.price === 'number' ? `$${Math.round(display.price / 100)}` : ''

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px 48px' }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>

        {/* back — a plain control, never the brightest thing on screen */}
        <button onClick={goBack} className="pressable"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'none', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 2px' }}
          onMouseOver={(e) => { e.currentTarget.style.color = BONE_MID }}
          onMouseOut={(e) => { e.currentTarget.style.color = BONE_LOW }}>
          <ArrowLeft size={13} /> Back to the event
        </button>

        {/* header — the room the buyer is paying into, in our own type */}
        <div style={{ marginTop: '14px', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: SILVER, letterSpacing: '.28em', textTransform: 'uppercase' }}>Secure checkout</div>
          <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(34px,10vw,46px)', lineHeight: .92, color: BONE, margin: '10px 0 0', letterSpacing: '.01em' }}>
            {display?.title || 'RAN BY ARTISTS'}
          </h1>
          {(display?.tierName || priceLabel) && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {display?.tierName && (
                <span style={{ fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', color: BONE, border: `1px solid ${HAIR}`, borderRadius: '100px', padding: '5px 12px' }}>{display.tierName}</span>
              )}
              {priceLabel && <span style={{ fontFamily: 'Bebas Neue', fontSize: '22px', color: BONE, letterSpacing: '.02em' }}>{priceLabel}</span>}
            </div>
          )}
        </div>

        {/* THE PANEL — our frame around Stripe's card form. The iframe Stripe
            renders inside inherits the Dashboard branding; the frame is ours. */}
        {phase !== 'error' && (
          <div style={{ position: 'relative', border: `1px solid ${HAIR}`, borderRadius: '16px', background: 'rgba(var(--void-rgb),.55)', backdropFilter: 'blur(8px)', padding: '14px', minHeight: '320px', boxShadow: '0 12px 40px rgba(0,0,0,.28)' }}>
            {phase === 'loading' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                <Loader2 size={22} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
                <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_LOW, letterSpacing: '.22em', textTransform: 'uppercase' }}>Preparing your checkout…</div>
              </div>
            )}
            {/* Stripe mounts here. Kept in the tree across loading so the ref is
                live when mount() fires; the spinner sits on top until ready. */}
            <div ref={mountRef} data-testid="embedded-mount" style={{ opacity: phase === 'ready' ? 1 : 0, transition: 'opacity .3s ease' }} />
          </div>
        )}

        {/* error — honest, with a way out (Ley 11) */}
        {phase === 'error' && (
          <div style={{ border: '1px solid rgba(229,160,160,.32)', borderRadius: '16px', background: 'rgba(229,160,160,.05)', padding: '26px 22px', textAlign: 'center' }}>
            <div style={{ width: '46px', height: '46px', margin: '0 auto', borderRadius: '50%', border: '1px solid rgba(229,160,160,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={20} style={{ color: 'var(--rust)' }} />
            </div>
            <div style={{ fontFamily: 'DM Sans', fontSize: '14px', color: BONE_MID, lineHeight: 1.6, marginTop: '16px' }}>{error}</div>
            <button onClick={goBack}
              style={{ marginTop: '22px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: BONE, border: 'none', borderRadius: '12px', padding: '13px 24px', color: VOID, fontFamily: 'DM Sans', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              <ArrowLeft size={16} /> Back to the event
            </button>
          </div>
        )}

        {/* trust line — quiet, factual */}
        {phase !== 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '18px' }}>
            <ShieldCheck size={13} style={{ color: BONE_LOW }} />
            <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.1em', textTransform: 'uppercase' }}>Secured by Stripe · your card never touches our servers</span>
          </div>
        )}
      </div>
    </div>
  )
}
