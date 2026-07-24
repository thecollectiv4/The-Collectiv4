import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Loader2, ArrowRight, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react'
import { BONE, BONE_MID, BONE_LOW, FAINT, SILVER, STAR, HAIR, HAIR_HI, WARN, FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText, safeImg } from '@/lib/cosmos'
import { fetchService, createBookingSession, fmtMoney } from '@/lib/bookings'
import { getBookingStripe } from '@/lib/stripe'

/* =========================================================================
   BookService — /book/:id. The public payment page for a creative's
   service. The client usually arrives from OUTSIDE the app (a DM, a
   WhatsApp link) with no account — so this page is two things at once:
   a premium checkout, and the client's first sight of The Collectiv4.
   The acquisition thesis lives here: the room is visible, never a banner.

   Standalone route (no nav), same shell as /claim: transparent over the
   shared sky, narrow column — a form's correct desktop shape.
   ========================================================================= */

const MARKS = ['●', '○', '✕', '△', '◇']

/* `preview` exists for the DEV-only harness (/__book) — a static mock so the
   page can be design-QA'd without touching real data. No prod route passes it. */
export default function BookService({ preview }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const cancelled = params.get('cancelled') === '1'

  // phase: loading | ready | paying | notfound
  const [phase, setPhase] = useState('loading')
  const [service, setService] = useState(null)

  // v21 — el pago en casa: the embedded card form mounts in the `paying` phase
  const [clientSecret, setClientSecret] = useState('')
  const [payReady, setPayReady] = useState(false)
  const [payError, setPayError] = useState('')
  const mountRef = useRef(null)

  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [brief, setBrief] = useState('')
  const [date, setDate] = useState('')
  const [place, setPlace] = useState('')
  const [links, setLinks] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [agreeError, setAgreeError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (preview) { setService(preview); setPhase('ready'); return }
    let alive = true
    setPhase('loading')
    fetchService(id).then((s) => {
      if (!alive) return
      if (!s || s.listing.status !== 'live') { setPhase('notfound'); return }
      setService(s)
      setPhase('ready')
    })
    return () => { alive = false }
  }, [id, preview])

  const pay = async () => {
    if (submitting) return
    setErr('')
    if (!brief.trim()) { setErr('Tell the creative what you need — that field is the work order.'); return }
    if (!clientName.trim()) { setErr('Your name — so the creative knows who booked them.'); return }
    if (!/.+@.+\..+/.test(clientEmail.trim())) { setErr('A real email — your receipt and the creative’s reply land there.'); return }
    if (!agreed) { setAgreeError(true); return }
    // Fail fast (with the form + everything typed intact) if the booking Stripe
    // isn't configured — never transition to a payment screen that can't mount.
    if (!getBookingStripe()) { setErr('Payments aren’t available right now — nothing was charged. Try again shortly or DM @thecollectiv4.'); return }
    setSubmitting(true)
    try {
      // v21 — the session is now EMBEDDED: we get a clientSecret and mount the
      // card form in-place (the `paying` phase) instead of leaving for
      // checkout.stripe.com. The return_url (with the booking id) is baked
      // server-side, so a completed payment lands on /booked on its own.
      const { clientSecret: cs } = await createBookingSession({
        listingId: id,
        client: { name: clientName.trim(), email: clientEmail.trim() },
        request: { brief: brief.trim(), date: date.trim(), place: place.trim(), links: links.trim() },
        agreed: true,
      })
      if (!cs) throw new Error('couldn’t start the payment — nothing was charged.')
      setClientSecret(cs)
      setPayReady(false)
      setPayError('')
      setPhase('paying')
    } catch (e) {
      setErr(e?.message || 'couldn’t start the payment — nothing was charged.')
      setSubmitting(false)
    }
  }

  // Back from the card form → the booking form, everything typed still there
  // (this component never unmounts, so its field state survives). Clearing
  // clientSecret tears down the mounted Stripe instance via the effect cleanup.
  const cancelPay = () => {
    setClientSecret('')
    setPayReady(false)
    setPayError('')
    setSubmitting(false)
    setPhase('ready')
  }

  // Mount Stripe Embedded Checkout for the BOOKING account once we have a
  // clientSecret. Mirrors CheckoutEmbedded (v20): createEmbeddedCheckoutPage on
  // this account's Stripe.js (the legacy initEmbeddedCheckout THROWS here), a
  // framed panel, honest states, teardown on unmount. Uses the booking
  // publishable key — a DIFFERENT Stripe instance from the ticket checkout.
  useEffect(() => {
    if (preview) return
    if (phase !== 'paying' || !clientSecret) return
    let cancelled = false
    let checkout = null

    const stripePromise = getBookingStripe()
    if (!stripePromise) { setPayError('Payments aren’t available right now. Try again shortly or DM @thecollectiv4.'); return }

    ;(async () => {
      let stripe
      try {
        stripe = await stripePromise
      } catch {
        if (!cancelled) setPayError('Payments aren’t available right now. Try again shortly.')
        return
      }
      if (!stripe || cancelled) return
      try {
        const initEmbedded = stripe.createEmbeddedCheckoutPage || stripe.initEmbeddedCheckout
        checkout = await initEmbedded.call(stripe, { clientSecret })
        if (cancelled || !mountRef.current) { try { checkout.destroy() } catch { /* noop */ } return }
        checkout.mount(mountRef.current)
        setPayReady(true)
      } catch {
        if (!cancelled) setPayError('We couldn’t load the payment form. Try again.')
      }
    })()

    return () => { cancelled = true; if (checkout) { try { checkout.destroy() } catch { /* noop */ } } }
  }, [phase, clientSecret, preview])

  const shell = (children) => (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', padding: '28px 24px 64px' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>{children}</div>
    </div>
  )

  if (phase === 'loading') return shell(
    <div style={{ textAlign: 'center', paddingTop: '38vh' }}>
      <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase', marginTop: '16px' }}>Opening the booking…</div>
    </div>
  )

  if (phase === 'notfound') return shell(
    <div style={{ textAlign: 'center', paddingTop: '30vh' }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: '20px', color: BONE_MID }}>△</div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(34px,10vw,44px)', lineHeight: .9, margin: '14px 0 0', color: BONE }}>THIS LINK ISN’T LIVE</h1>
      <p style={{ fontFamily: FONT_SANS, fontSize: '14px', color: BONE_MID, lineHeight: 1.6, margin: '16px auto 0', maxWidth: '340px' }}>
        The service behind it was taken down or the link is wrong. Nothing was charged.
      </p>
      <button onClick={() => navigate('/')} style={{ ...cta, marginTop: '26px' }} onMouseOver={hoverIn} onMouseOut={hoverOut}>
        See The Collectiv4 <ArrowRight size={16} />
      </button>
    </div>
  )

  // v21 — el pago en casa: the card form lives HERE, on our domain, dressed in
  // Cosmos — never a bounce to checkout.stripe.com the moment the client reaches
  // for their card. The service + creative + price stay in view for context
  // (send-off 2.2/2.4); the request they already wrote is preserved behind this
  // screen, so "back" returns them to it untouched.
  if (phase === 'paying') {
    const { listing: pl, creative: pc } = service
    const pName = pc.full_name || pc.username || 'the creative'
    const pAvatar = safeImg(pc.avatar_url)
    return shell(
      <>
        {/* the venue signs quietly at the top — the room, not a banner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase' }}>The Collectiv4</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: SILVER, letterSpacing: '.28em', textTransform: 'uppercase' }}>Secure checkout</span>
        </div>

        {/* back — a plain control, never the brightest thing on screen. Returns
            to the booking with everything already typed still there. */}
        <button onClick={cancelPay} className="pressable"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'none', border: 'none', color: BONE_LOW, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 2px' }}
          onMouseOver={(e) => { e.currentTarget.style.color = BONE_MID }}
          onMouseOut={(e) => { e.currentTarget.style.color = BONE_LOW }}>
          <ArrowLeft size={13} /> Back to the booking
        </button>

        {/* context — who they're paying, for what, how much (never a mystery charge) */}
        <div style={{ marginTop: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          {pAvatar ? (
            <img src={pAvatar} alt={pName} style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HAIR_HI}`, flexShrink: 0 }} />
          ) : (
            <div aria-hidden style={{ width: '46px', height: '46px', borderRadius: '50%', border: `1px solid ${HAIR_HI}`, background: 'rgba(var(--silver-rgb),.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: '20px', color: BONE_MID }}>{pName[0]?.toUpperCase()}</span>
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase' }}>Booking · {pName}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: '22px', color: BONE, letterSpacing: '.01em', lineHeight: 1.05, marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.title}</div>
          </div>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: '26px', lineHeight: 1, ...chromeText, flexShrink: 0 }}>{fmtMoney(pl.price_cents)}</span>
        </div>

        {/* THE PANEL — our frame around Stripe's booking card form. The iframe
            Stripe renders inside inherits the Dashboard branding; the frame is ours. */}
        {!payError && (
          <div style={{ position: 'relative', border: `1px solid ${HAIR_HI}`, borderRadius: '16px', background: 'rgba(var(--void-rgb),.55)', backdropFilter: 'blur(8px)', padding: '14px', minHeight: '320px', boxShadow: '0 12px 40px rgba(0,0,0,.28)' }}>
            {!payReady && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                <Loader2 size={22} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
                <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.22em', textTransform: 'uppercase' }}>Preparing your checkout…</div>
              </div>
            )}
            {/* Stripe mounts here. Kept in the tree across loading so the ref is
                live when mount() fires; the spinner sits on top until ready. */}
            <div ref={mountRef} data-testid="booking-embedded-mount" style={{ opacity: payReady ? 1 : 0, transition: 'opacity .3s ease' }} />
          </div>
        )}

        {/* error — honest, with a way back to the booking (Ley 11) */}
        {payError && (
          <div style={{ border: '1px solid rgba(229,160,160,.32)', borderRadius: '16px', background: 'rgba(229,160,160,.05)', padding: '26px 22px', textAlign: 'center' }}>
            <div style={{ width: '46px', height: '46px', margin: '0 auto', borderRadius: '50%', border: '1px solid rgba(229,160,160,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={20} style={{ color: 'var(--rust)' }} />
            </div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '14px', color: BONE_MID, lineHeight: 1.6, marginTop: '16px' }}>{payError}</div>
            <button onClick={cancelPay}
              style={{ marginTop: '22px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: BONE, border: 'none', borderRadius: '12px', padding: '13px 24px', color: 'var(--bg)', fontFamily: FONT_SANS, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              <ArrowLeft size={16} /> Back to the booking
            </button>
          </div>
        )}

        {/* trust line — quiet, factual */}
        {!payError && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '18px' }}>
            <ShieldCheck size={13} style={{ color: BONE_LOW }} />
            <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.1em', textTransform: 'uppercase' }}>Secured by Stripe · your card never touches our servers</span>
          </div>
        )}
      </>
    )
  }

  const { listing, creative } = service
  const creativeName = creative.full_name || creative.username || 'the creative'
  const firstName = creativeName.split(' ')[0]
  const img = safeImg(listing.images?.[0]?.url)
  const avatar = safeImg(creative.avatar_url)

  return shell(
    <>
      {/* the venue signs quietly at the top — the room, not a banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '34px' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase' }}>The Collectiv4</span>
        <span aria-hidden style={{ fontFamily: FONT_MONO, fontSize: '9px', color: FAINT, letterSpacing: '.4em' }}>{MARKS.join(' ')}</span>
      </div>

      {cancelled && (
        <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.08em', border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '10px 14px', marginBottom: '22px' }}>
          △ Payment cancelled — nothing was charged. The booking is still open below.
        </div>
      )}

      {/* the creative — who the client is actually paying */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {avatar ? (
          <img src={avatar} alt={creativeName} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HAIR_HI}`, flexShrink: 0 }} />
        ) : (
          <div aria-hidden style={{ width: '64px', height: '64px', borderRadius: '50%', border: `1px solid ${HAIR_HI}`, background: 'rgba(var(--silver-rgb),.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: '26px', color: BONE_MID }}>{creativeName[0]?.toUpperCase()}</span>
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(30px,8vw,38px)', lineHeight: .92, margin: 0, color: BONE, letterSpacing: '.01em' }}>{creativeName.toUpperCase()}</h1>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9.5px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: '6px' }}>
            {[creative.username ? `@${creative.username}` : null, creative.city].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
      {creative.bio && (
        <p className="fade-up fade-up-1" style={{ fontFamily: FONT_SANS, fontSize: '13px', color: BONE_MID, lineHeight: 1.6, margin: '14px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{creative.bio}</p>
      )}

      {/* the service — a specimen card, the price set like a display fact */}
      <div className="fade-up fade-up-2" style={{ marginTop: '26px', border: `1px solid ${HAIR_HI}`, borderRadius: '16px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        {img && (
          <div style={{ position: 'relative', height: '180px', overflow: 'hidden', background: 'var(--bg-deep-2)' }}>
            <img src={img} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(var(--void-rgb),0) 55%, rgba(var(--void-rgb),.72) 100%)' }} />
          </div>
        )}
        <div style={{ padding: '20px 22px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: FONT_MONO, fontSize: '7.5px', color: SILVER, letterSpacing: '.2em', border: '1px solid rgba(var(--silver-rgb),.25)', borderRadius: '100px', padding: '3px 10px' }}>SERVICE</span>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: '27px', color: BONE, letterSpacing: '.02em', lineHeight: 1, marginTop: '12px' }}>{listing.title}</div>
          {listing.description && (
            <p style={{ fontFamily: FONT_SANS, fontSize: '13px', color: BONE_MID, lineHeight: 1.6, margin: '10px 0 0' }}>{listing.description}</p>
          )}
          {listing.delivery && (
            <div style={{ fontFamily: FONT_MONO, fontSize: '9.5px', color: BONE_LOW, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '12px' }}>Delivers · {listing.delivery}</div>
          )}
        </div>
        <div style={{ padding: '16px 22px', borderTop: `1px dashed ${HAIR_HI}`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.2em' }}>ONE BOOKING</span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: '34px', lineHeight: 1, ...chromeText }}>{fmtMoney(listing.price_cents)}</span>
        </div>
      </div>

      {/* the request — what the creative needs to deliver well */}
      <SectionHead mark="●" title="The request" note={`what ${firstName} needs from you`} />
      <Field label="What do you need?">
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} maxLength={1000}
          placeholder="The job, in your own words — the clearer the brief, the better the work."
          style={{ ...input, resize: 'vertical', minHeight: '96px' }} onFocus={focusIn} onBlur={focusOut} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="When">
          <input value={date} onChange={(e) => setDate(e.target.value)} maxLength={40} placeholder="A date or a deadline" style={input} onFocus={focusIn} onBlur={focusOut} />
        </Field>
        <Field label="Where">
          <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={160} placeholder="Houston · online · a venue" style={input} onFocus={focusIn} onBlur={focusOut} />
        </Field>
      </div>
      <Field label="References — optional">
        <input value={links} onChange={(e) => setLinks(e.target.value)} maxLength={400} placeholder="Links, moodboards, songs" style={input} onFocus={focusIn} onBlur={focusOut} />
      </Field>

      {/* the client — receipt + reply land here */}
      <SectionHead mark="○" title="You" note="your receipt and the reply land here" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Name">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={120} placeholder="Your name" style={input} onFocus={focusIn} onBlur={focusOut} autoComplete="name" />
        </Field>
        <Field label="Email">
          <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} maxLength={200} type="email" placeholder="you@…" style={input} onFocus={focusIn} onBlur={focusOut} autoComplete="email" />
        </Field>
      </div>

      {/* consent — same grammar as the ticket checkout */}
      <div style={{ border: `1px solid ${agreeError ? 'rgba(229,160,160,.5)' : 'rgba(var(--ink-rgb),.14)'}`, borderRadius: '10px', padding: '12px 14px', background: 'rgba(var(--ink-rgb),.02)', marginTop: '22px', transition: 'border-color .2s' }}>
        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setAgreeError(false) }}
            style={{ accentColor: 'var(--cream)', width: '15px', height: '15px', marginTop: '2px', flexShrink: 0, cursor: 'pointer' }} />
          <span style={{ fontFamily: FONT_SANS, fontSize: '11px', color: BONE_MID, lineHeight: 1.55 }}>
            I agree to the{' '}
            <a href="/booking-terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: BONE, textDecoration: 'underline' }}>Booking Terms</a> and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: BONE, textDecoration: 'underline' }}>Privacy Policy</a>.{' '}
            <span style={{ color: BONE_LOW }}>The work agreement is between you and {firstName}; The Collectiv4 processes the payment.</span>
          </span>
        </label>
        {agreeError && <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: WARN, letterSpacing: '.06em', marginTop: '8px', paddingLeft: '25px' }}>△ Please accept to continue.</div>}
      </div>

      {err && <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: WARN, letterSpacing: '.04em', marginTop: '14px', lineHeight: 1.5 }}>△ {err}</div>}

      <button onClick={pay} disabled={submitting} style={{ ...cta, width: '100%', marginTop: '18px', opacity: submitting ? .7 : 1 }} onMouseOver={hoverIn} onMouseOut={hoverOut}>
        {submitting
          ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Opening secure checkout…</>
          : <>Pay {fmtMoney(listing.price_cents)} — book {firstName} <ArrowRight size={17} /></>}
      </button>
      <div style={{ fontFamily: FONT_MONO, fontSize: '8.5px', color: FAINT, letterSpacing: '.18em', textTransform: 'uppercase', textAlign: 'center', marginTop: '12px' }}>
        Apple Pay · Card — secured by Stripe
      </div>

      {/* the room, visible — the acquisition thesis, said once and quietly */}
      <div style={{ marginTop: '44px', paddingTop: '22px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: STAR, boxShadow: '0 0 8px rgba(var(--star-rgb),.6)', flexShrink: 0 }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase' }}>This booking lives in The Collectiv4</span>
        </div>
        <p style={{ fontFamily: FONT_SANS, fontSize: '12.5px', color: BONE_LOW, lineHeight: 1.65, margin: '10px 0 0' }}>
          The room where Houston’s creatives and the people who book them actually meet — every profile a world, every booking real. Paying opens your door.
        </p>
        <Link to="/c4" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '12px', fontFamily: FONT_MONO, fontSize: '9.5px', color: BONE_MID, letterSpacing: '.16em', textTransform: 'uppercase', textDecoration: 'none' }}>
          See the room <ArrowRight size={12} />
        </Link>
      </div>
    </>
  )
}

function SectionHead({ mark, title, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '32px 0 14px' }}>
      <span aria-hidden style={{ fontFamily: FONT_MONO, fontSize: '10px', color: SILVER }}>{mark}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE, letterSpacing: '.24em', textTransform: 'uppercase' }}>{title}</span>
      {note && <span style={{ fontFamily: FONT_MONO, fontSize: '8.5px', color: FAINT, letterSpacing: '.08em' }}>{note}</span>}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: '12px' }}>
      <span style={{ display: 'block', fontFamily: FONT_MONO, fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: '7px' }}>{label}</span>
      {children}
    </label>
  )
}

const input = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(var(--ink-rgb),.03)',
  border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 14px',
  color: BONE, fontFamily: FONT_SANS, fontSize: '14px', lineHeight: 1.5,
  outline: 'none', transition: 'border-color .2s, background .2s',
}
const focusIn = (e) => { e.currentTarget.style.borderColor = 'rgba(var(--silver-rgb),.55)'; e.currentTarget.style.background = 'rgba(var(--ink-rgb),.05)' }
const focusOut = (e) => { e.currentTarget.style.borderColor = HAIR_HI; e.currentTarget.style.background = 'rgba(var(--ink-rgb),.03)' }

const cta = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
  background: BONE, border: 'none', borderRadius: '12px', padding: '16px 28px', color: 'var(--bg)',
  fontFamily: FONT_SANS, fontSize: '14px', fontWeight: 600, letterSpacing: '.01em', cursor: 'pointer',
  transition: 'transform .2s, box-shadow .2s',
}
const hoverIn = (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(var(--silver-rgb),.18)' }
const hoverOut = (e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }
