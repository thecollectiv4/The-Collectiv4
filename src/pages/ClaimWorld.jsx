import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { Loader2, ArrowRight, Check, Sparkles, RotateCcw } from 'lucide-react'

/* =========================================================================
   ClaimWorld — the post-purchase retention bridge (the flywheel hook).
   success_url from Stripe checkout lands here. A ticket buyer is authenticated
   (checkout requires login), so we: link any orphaned ticket bought under their
   email to their profile (claim_my_tickets RPC, best-effort), confirm the
   ticket, and drive them to BUILD THEIR WORLD — turning a buyer into a museum.
   Cosmos-chrome, same universe as the profile-museum.

   ACTION INTEGRITY (platform-wide invariant): this surface NEVER says "YOU'RE
   IN" until it has VERIFIED a real confirmed ticket row against the DB. The
   webhook that writes that row is async (Stripe delivers seconds later, and can
   fail), so we POLL the source of truth (every 2s, up to ~20s):
     confirming → confirmed   (a real ticket row appeared)
     confirming → notfound    (timeout: honest error + retry, never a false YES)
   A "confirmed" screen with no ticket behind it is the same disease as a chip
   with no tool call — forbidden. The check follows the row, never leads it.
   ========================================================================= */

const VOID = '#0A0A0D'
const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const SILVER = '#C7C9D1'
const STAR = '#E8E9ED'
const HAIR_HI = 'rgba(242,238,230,0.15)'
const CHROME = 'linear-gradient(100deg,#F6F6FA 0%,#A6ABBA 26%,#FCFCFE 50%,#8E94A6 73%,#EFEFF4 100%)' // deck formula — jewelry, one moment per screen (v8 D3)
const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

const POLL_MS = 2000
const MAX_ATTEMPTS = 10   // ~20s of webhook grace before the honest error state

export default function ClaimWorld() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const live = useLiveEvent()
  // phase: loading | confirming | confirmed | notfound | loggedout
  const [phase, setPhase] = useState('loading')
  const [ticket, setTicket] = useState(null)
  const [profile, setProfile] = useState(null)
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setPhase('loggedout'); return }
    let alive = true
    let attempts = 0
    let timer = null
    setPhase('loading')

    // profile drives build-vs-open copy; load it once, non-blocking.
    // is_demo travels with the identity (guardrail 4) — even the self-row
    supabase.from('profiles').select('id, full_name, username, bio, taste, media, is_demo')
      .eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (alive) setProfile(data || null) })

    // Poll the source of truth. Each round re-runs claim_my_tickets (best-effort,
    // links an orphaned ticket bought under this email) then reads the real row.
    async function poll() {
      if (!alive) return
      try { await supabase.rpc('claim_my_tickets') } catch (e) { /* non-fatal */ }
      const { data: tk } = await supabase
        .from('tickets').select('*')
        .eq('buyer_id', user.id).eq('status', 'confirmed')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!alive) return
      if (tk) { setTicket(tk); setPhase('confirmed'); return }   // VERIFIED — only now do we say yes
      attempts += 1
      if (attempts >= MAX_ATTEMPTS) { setPhase('notfound'); return }  // honest timeout, never a false confirm
      setPhase('confirming')
      timer = setTimeout(poll, POLL_MS)
    }
    poll()
    return () => { alive = false; if (timer) clearTimeout(timer) }
  }, [user, authLoading, retryNonce])

  const retry = useCallback(() => { setTicket(null); setPhase('loading'); setRetryNonce((n) => n + 1) }, [])

  const hasWorld = !!(profile && (profile.bio || profile.username ||
    (profile.taste && (profile.taste.music?.length || profile.taste.films?.length || profile.taste.influences?.length)) ||
    (profile.media && profile.media.length)))

  const shell = (children) => (
    // v12: this used to hand-copy the canvas void gradient verbatim — the
    // post-purchase ceremony rendered a still photograph of the sky instead
    // of the sky. Now transparent: the real one is behind it (App.jsx).
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 28px', overflow: 'hidden' }}>
      {children}
    </div>
  )

  // ---- confirming: payment done, waiting on the webhook to write the ticket ----
  if (authLoading || phase === 'loading' || phase === 'confirming') return shell(
    <div style={{ textAlign: 'center', maxWidth: '360px', margin: '0 auto' }}>
      <Loader2 size={22} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
      <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase', marginTop: '18px' }}>Confirming your ticket…</div>
      <p style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_LOW, lineHeight: 1.6, marginTop: '12px' }}>
        Your payment went through. We’re waiting for the confirmation to land — usually just a few seconds.
      </p>
    </div>
  )

  // ---- logged out (opened the email link on another device / expired session) ----
  if (!user || phase === 'loggedout') return shell(
    <div style={{ textAlign: 'center', maxWidth: '420px', margin: '0 auto' }}>
      <Kicker>Ran By Artists</Kicker>
      <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(40px,13vw,54px)', lineHeight: .9, margin: '14px 0 0', ...chromeText }}>CLAIM YOUR<br />TICKET</h1>
      <p style={{ fontFamily: 'DM Sans', fontSize: '15px', color: BONE_MID, lineHeight: 1.6, margin: '22px auto 0', maxWidth: '340px' }}>
        Sign in with the email you used at checkout to claim your world — your profile, your ticket, your place in the room.
      </p>
      <button onClick={() => navigate('/auth?next=/claim')} style={ctaStyle} onMouseOver={hoverIn} onMouseOut={hoverOut}>
        Sign in to claim <ArrowRight size={17} />
      </button>
    </div>
  )

  // ---- notfound: timed out without a real ticket. Honest error, never a false YES ----
  if (phase === 'notfound') return shell(
    <div style={{ textAlign: 'center', maxWidth: '420px', margin: '0 auto' }}>
      <div style={{ width: '52px', height: '52px', margin: '0 auto', borderRadius: '50%', border: `1px solid ${HAIR_HI}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: '20px', color: BONE_MID, lineHeight: 1 }}>△</span>
      </div>
      <div style={{ marginTop: '18px' }}><Kicker>Ran By Artists</Kicker></div>
      <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(34px,11vw,48px)', lineHeight: .9, margin: '12px 0 0', color: BONE }}>STILL CONFIRMING</h1>
      <p style={{ fontFamily: 'DM Sans', fontSize: '15px', color: BONE_MID, lineHeight: 1.65, margin: '18px auto 0', maxWidth: '360px' }}>
        Your payment went through, but the ticket confirmation hasn’t landed yet. This is almost always a short delay — give it a moment and retry. We won’t show you as in until it’s real.
      </p>
      <button onClick={retry} style={{ ...ctaStyle, width: '100%', marginTop: '26px' }} onMouseOver={hoverIn} onMouseOut={hoverOut}>
        <RotateCcw size={16} /> Retry
      </button>
      <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_LOW, letterSpacing: '.06em', marginTop: '16px', lineHeight: 1.6 }}>
        Still nothing after a minute? DM <span style={{ color: BONE_MID }}>@thecollectiv4</span> with your receipt<br />and we’ll confirm it by hand.
      </div>
    </div>
  )

  // ---- confirmed + authenticated: the hook. `ticket` is guaranteed real here ----
  const firstName = (profile?.full_name || user.user_metadata?.full_name || '').split(' ')[0]
  return shell(
    <div style={{ maxWidth: '440px', margin: '0 auto', width: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        {/* the mark: the ring draws itself clockwise, the check surfaces as it closes */}
        <div style={{ position: 'relative', width: '52px', height: '52px', margin: '0 auto' }}>
          <svg width="52" height="52" viewBox="0 0 52 52" style={{ display: 'block', margin: '0 auto' }} aria-hidden>
            <circle className="ring-draw" cx="26" cy="26" r="25.5" fill="none" stroke={SILVER} strokeWidth="1"
              transform="rotate(-90 26 26)" style={{ filter: 'drop-shadow(0 0 10px rgba(199,201,209,.25))' }} />
          </svg>
          <Check size={22} className="rise" style={{ color: STAR, position: 'absolute', inset: 0, margin: 'auto', animationDelay: '450ms' }} />
        </div>
        <div className="rise rise-1" style={{ marginTop: '18px' }}><Kicker>{live?.name || 'Ran By Artists'}{live?.editionNumber ? ` · ${live.editionNumber}` : ''}</Kicker></div>
        <h1 className="rise rise-2" style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(40px,13vw,56px)', lineHeight: .88, margin: '12px 0 0', ...chromeText }}>
          {firstName ? `YOU'RE IN, ${firstName.toUpperCase()}` : "YOU'RE IN"}
        </h1>
        <p className="rise rise-3" style={{ fontFamily: 'DM Sans', fontSize: '15px', color: BONE_MID, lineHeight: 1.65, margin: '18px auto 0', maxWidth: '360px' }}>
          {hasWorld
            ? 'Your ticket is confirmed and tied to your world. Add to it before the night — the room will see it.'
            : 'Your ticket is confirmed. Now build your world — a personal museum of your sound, your work, your influences. It’s how the room finds you.'}
        </p>
      </div>

      {/* ticket chip — always present in this state (phase=confirmed ⇒ ticket exists) */}
      <div className="rise rise-4" style={{ marginTop: '26px', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', border: `1px solid ${HAIR_HI}`, borderRadius: '14px', background: 'rgba(199,201,209,.04)' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: STAR, boxShadow: '0 0 8px rgba(232,233,237,.7)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.2em' }}>CONFIRMED</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: '12px', color: BONE, letterSpacing: '.04em', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.qr_code}</div>
        </div>
        {typeof ticket.price_paid === 'number' && (
          <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_LOW }}>${(ticket.price_paid / 100).toFixed(0)} PAID</span>
        )}
      </div>

      {/* the hook — build/open your world */}
      {/* the rise animates the WRAPPER: a filled animation outranks inline styles,
          so a .rise on the button itself would kill its hover lift for good. */}
      <div className="rise rise-5" style={{ marginTop: '22px', display: 'flex' }}>
        <button onClick={() => navigate('/profile')} style={{ ...ctaStyle, marginTop: 0, width: '100%' }} onMouseOver={hoverIn} onMouseOut={hoverOut}>
          {hasWorld ? 'Open your world' : 'Build your world'} <ArrowRight size={18} />
        </button>
      </div>

      {!hasWorld && (
        <div className="rise rise-5" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '9px', justifyContent: 'center' }}>
          <Sparkles size={13} style={{ color: SILVER }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: '9.5px', color: BONE_LOW, letterSpacing: '.14em', textTransform: 'uppercase' }}>Takes two minutes · paste a link, it comes alive</span>
        </div>
      )}

      <button className="rise rise-5" onClick={() => navigate('/')} style={{ display: 'block', margin: '22px auto 0', background: 'none', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.1em', cursor: 'pointer' }}>
        Later — take me home
      </button>
    </div>
  )
}

function Kicker({ children }) {
  return <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: SILVER, letterSpacing: '.28em', textTransform: 'uppercase' }}>{children}</div>
}

const ctaStyle = {
  marginTop: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
  background: BONE, border: 'none', borderRadius: '12px', padding: '16px 28px', color: VOID,
  fontFamily: 'DM Sans', fontSize: '14px', fontWeight: 600, letterSpacing: '.01em', cursor: 'pointer', transition: 'transform .2s, box-shadow .2s',
}
const hoverIn = (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(199,201,209,.18)' }
const hoverOut = (e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }
