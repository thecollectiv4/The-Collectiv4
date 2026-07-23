import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ArrowRight, Check, RotateCcw } from 'lucide-react'
import { BONE, BONE_MID, BONE_LOW, SILVER, STAR, HAIR_HI, FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText } from '@/lib/cosmos'
import { fetchBookingStatus, fmtMoney } from '@/lib/bookings'

/* =========================================================================
   Booked — /booked?bid=…&session_id=…. The success_url of a booking
   payment. ACTION INTEGRITY (the ClaimWorld invariant): this surface
   NEVER says "BOOKED" until the DB row says paid — the webhook lands
   seconds later and can fail, so we POLL the truth and time out into an
   honest error, never a false yes.

   The client here usually has NO account — this screen is the second
   half of the acquisition thesis: the receipt is the invitation.
   ========================================================================= */

const POLL_MS = 2000
const MAX_ATTEMPTS = 10 // ~20s of webhook grace before the honest error state

/* `preview` exists for the DEV-only harness (/__book) — a static mock so the
   ceremony can be design-QA'd without a real payment. No prod route passes it. */
export default function Booked({ preview }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const bid = params.get('bid') || ''
  const sessionId = params.get('session_id') || ''

  // phase: confirming | confirmed | notfound | badlink
  const [phase, setPhase] = useState(preview ? 'confirmed' : 'confirming')
  const [booking, setBooking] = useState(preview || null)
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    if (preview) return
    if (!bid || !sessionId) { setPhase('badlink'); return }
    let alive = true
    let attempts = 0
    let timer = null
    setPhase('confirming')

    async function poll() {
      if (!alive) return
      const b = await fetchBookingStatus(bid, sessionId)
      if (!alive) return
      if (b && (b.status === 'paid' || b.status === 'delivered')) {
        setBooking(b); setPhase('confirmed'); return // VERIFIED — only now do we say yes
      }
      attempts += 1
      if (attempts >= MAX_ATTEMPTS) { setPhase('notfound'); return } // honest timeout
      timer = setTimeout(poll, POLL_MS)
    }
    poll()
    return () => { alive = false; if (timer) clearTimeout(timer) }
  }, [bid, sessionId, retryNonce, preview])

  const retry = useCallback(() => { setBooking(null); setRetryNonce((n) => n + 1) }, [])

  const shell = (children) => (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 28px', overflow: 'hidden' }}>
      {children}
    </div>
  )

  if (phase === 'confirming') return shell(
    <div style={{ textAlign: 'center', maxWidth: '360px', margin: '0 auto' }}>
      <Loader2 size={22} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase', marginTop: '18px' }}>Confirming your booking…</div>
      <p style={{ fontFamily: FONT_SANS, fontSize: '13px', color: BONE_LOW, lineHeight: 1.6, marginTop: '12px' }}>
        Your payment went through. We’re waiting for the confirmation to land — usually just a few seconds.
      </p>
    </div>
  )

  if (phase === 'badlink' || phase === 'notfound') return shell(
    <div style={{ textAlign: 'center', maxWidth: '420px', margin: '0 auto' }}>
      <div style={{ width: '52px', height: '52px', margin: '0 auto', borderRadius: '50%', border: `1px solid ${HAIR_HI}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: '20px', color: BONE_MID, lineHeight: 1 }}>△</span>
      </div>
      <div style={{ marginTop: '18px' }}><Kicker>The Collectiv4</Kicker></div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(34px,11vw,48px)', lineHeight: .9, margin: '12px 0 0', color: BONE }}>
        {phase === 'badlink' ? 'THIS LINK IS INCOMPLETE' : 'STILL CONFIRMING'}
      </h1>
      <p style={{ fontFamily: FONT_SANS, fontSize: '15px', color: BONE_MID, lineHeight: 1.65, margin: '18px auto 0', maxWidth: '360px' }}>
        {phase === 'badlink'
          ? 'This page only works right after a payment. If you just paid, use the link from your receipt email.'
          : 'Your payment went through, but the confirmation hasn’t landed yet. Give it a moment and retry — we won’t call it booked until it’s real.'}
      </p>
      {phase === 'notfound' && (
        <>
          <button onClick={retry} style={{ ...cta, width: '100%', marginTop: '26px' }} onMouseOver={hoverIn} onMouseOut={hoverOut}>
            <RotateCcw size={16} /> Retry
          </button>
          <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.06em', marginTop: '16px', lineHeight: 1.6 }}>
            Still nothing after a minute? DM <span style={{ color: BONE_MID }}>@thecollectiv4</span> with your receipt<br />and we’ll confirm it by hand.
          </div>
        </>
      )}
    </div>
  )

  // ---- confirmed: `booking` is guaranteed real here ----
  const firstName = (booking.client_name || '').split(' ')[0]
  return shell(
    <div style={{ maxWidth: '440px', margin: '0 auto', width: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        {/* the mark: the ring draws itself clockwise, the check surfaces as it closes */}
        <div style={{ position: 'relative', width: '52px', height: '52px', margin: '0 auto' }}>
          <svg width="52" height="52" viewBox="0 0 52 52" style={{ display: 'block', margin: '0 auto' }} aria-hidden>
            <circle className="ring-draw" cx="26" cy="26" r="25.5" fill="none" stroke={SILVER} strokeWidth="1"
              transform="rotate(-90 26 26)" style={{ filter: 'drop-shadow(0 0 10px rgba(var(--silver-rgb),.25))' }} />
          </svg>
          <Check size={22} className="rise" style={{ color: STAR, position: 'absolute', inset: 0, margin: 'auto', animationDelay: '450ms' }} />
        </div>
        <div className="rise rise-1" style={{ marginTop: '18px' }}><Kicker>The Collectiv4</Kicker></div>
        <h1 className="rise rise-2" style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(40px,13vw,56px)', lineHeight: .88, margin: '12px 0 0', ...chromeText }}>
          {firstName ? `BOOKED, ${firstName.toUpperCase()}` : 'BOOKED'}
        </h1>
        <p className="rise rise-3" style={{ fontFamily: FONT_SANS, fontSize: '15px', color: BONE_MID, lineHeight: 1.65, margin: '18px auto 0', maxWidth: '360px' }}>
          {booking.creative_name ? `${booking.creative_name} has your request and your payment.` : 'The creative has your request and your payment.'}{' '}
          The receipt is in your inbox, and the reply lands at the same address.
        </p>
      </div>

      {/* booking chip — always real in this state */}
      <div className="rise rise-4" style={{ marginTop: '26px', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', border: `1px solid ${HAIR_HI}`, borderRadius: '14px', background: 'rgba(var(--silver-rgb),.04)' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: STAR, boxShadow: '0 0 8px rgba(var(--star-rgb),.7)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.2em' }}>PAID</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '12px', color: BONE, letterSpacing: '.04em', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{booking.service_title}</div>
        </div>
        <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW }}>{fmtMoney(booking.price_cents)}</span>
      </div>

      {/* the acquisition hook — the receipt is the invitation */}
      <p className="rise rise-5" style={{ fontFamily: FONT_SANS, fontSize: '13px', color: BONE_LOW, lineHeight: 1.65, margin: '24px auto 0', maxWidth: '360px', textAlign: 'center' }}>
        This happened inside The Collectiv4 — the room where the city’s creatives live. Claim your world and the next booking finds you already in it.
      </p>
      <div className="rise rise-5" style={{ marginTop: '18px', display: 'flex' }}>
        {/* Join door → ?mode=create (v17). ?next preserves this receipt —
            without it the new member lands on '/' and the paid-booking
            context (their one reason to be here) is dropped on the floor. */}
        <button onClick={() => navigate(`/auth?mode=create&next=${encodeURIComponent(window.location.pathname + window.location.search)}`)} style={{ ...cta, marginTop: 0, width: '100%' }} onMouseOver={hoverIn} onMouseOut={hoverOut}>
          Claim your world <ArrowRight size={18} />
        </button>
      </div>
      <button className="rise rise-5" onClick={() => navigate('/c4')} style={{ display: 'block', margin: '22px auto 0', background: 'none', border: 'none', color: BONE_LOW, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.1em', cursor: 'pointer' }}>
        Just look around first
      </button>
    </div>
  )
}

function Kicker({ children }) {
  return <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: SILVER, letterSpacing: '.28em', textTransform: 'uppercase' }}>{children}</div>
}

const cta = {
  marginTop: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
  background: BONE, border: 'none', borderRadius: '12px', padding: '16px 28px', color: 'var(--bg)',
  fontFamily: FONT_SANS, fontSize: '14px', fontWeight: 600, letterSpacing: '.01em', cursor: 'pointer', transition: 'transform .2s, box-shadow .2s',
}
const hoverIn = (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(var(--silver-rgb),.18)' }
const hoverOut = (e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }
