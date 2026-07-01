import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { Loader2, ArrowRight, Check, Sparkles } from 'lucide-react'

/* =========================================================================
   ClaimWorld — the post-purchase retention bridge (the flywheel hook).
   success_url from Stripe checkout lands here. A ticket buyer is authenticated
   (checkout requires login), so we: link any orphaned ticket bought under their
   email to their profile (claim_my_tickets RPC, best-effort), confirm the
   ticket, and drive them to BUILD THEIR WORLD — turning a buyer into a museum.
   Cosmos-chrome, same universe as the profile-museum.
   ========================================================================= */

const VOID = '#0A0A0D'
const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const SILVER = '#C7C9D1'
const STAR = '#E8E9ED'
const HAIR_HI = 'rgba(242,238,230,0.15)'
const CHROME = 'linear-gradient(176deg,#EEF0F4 0%,#BFC2CB 20%,#83868F 40%,#F7F9FD 52%,#7E818A 63%,#CED1DA 82%,#9497A0 100%)'
const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

export default function ClaimWorld() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const live = useLiveEvent()
  const [working, setWorking] = useState(true)
  const [ticket, setTicket] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    let alive = true
    async function run() {
      if (authLoading) return
      if (!user) { setWorking(false); return } // logged-out branch (email opened elsewhere)
      // Best-effort: link any orphaned ticket bought under this user's verified
      // email to their account. Safe to fail (e.g. RPC not yet deployed) — the
      // normal path already linked the ticket via buyer_id at checkout.
      try { await supabase.rpc('claim_my_tickets') } catch (e) { /* non-fatal */ }

      // Load the buyer's most recent confirmed ticket (RLS: buyer_id = auth.uid()).
      const { data: tk } = await supabase
        .from('tickets').select('*')
        .eq('buyer_id', user.id).eq('status', 'confirmed')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()

      // Load the profile to tell "build" from "open" your world.
      const { data: p } = await supabase
        .from('profiles').select('id, full_name, username, bio, taste, media')
        .eq('id', user.id).maybeSingle()

      if (!alive) return
      setTicket(tk || null)
      setProfile(p || null)
      setWorking(false)
    }
    run()
    return () => { alive = false }
  }, [user, authLoading])

  const hasWorld = !!(profile && (profile.bio || profile.username ||
    (profile.taste && (profile.taste.music?.length || profile.taste.films?.length || profile.taste.influences?.length)) ||
    (profile.media && profile.media.length)))

  const shell = (children) => (
    <div style={{ position: 'relative', minHeight: '100vh', background: `radial-gradient(120% 80% at 50% 0%, rgba(199,201,209,.07) 0%, transparent 55%), linear-gradient(180deg,#0B0B10 0%,#08080D 55%,#07080E 100%)`, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 28px', overflow: 'hidden' }}>
      {children}
    </div>
  )

  // ---- working / linking ----
  if (authLoading || working) return shell(
    <div style={{ textAlign: 'center' }}>
      <Loader2 size={22} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
      <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase', marginTop: '18px' }}>Linking your ticket</div>
    </div>
  )

  // ---- logged out (opened the email link on another device / expired session) ----
  if (!user) return shell(
    <div style={{ textAlign: 'center', maxWidth: '420px', margin: '0 auto' }}>
      <Kicker>Ran By Artists</Kicker>
      <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(40px,13vw,54px)', lineHeight: .9, margin: '14px 0 0', ...chromeText }}>YOUR TICKET<br />IS CONFIRMED</h1>
      <p style={{ fontFamily: 'DM Sans', fontSize: '15px', color: BONE_MID, lineHeight: 1.6, margin: '22px auto 0', maxWidth: '340px' }}>
        Sign in with the email you used at checkout to claim your world — your profile, your ticket, your place in the room.
      </p>
      <button onClick={() => navigate('/auth?next=/claim')} style={ctaStyle} onMouseOver={hoverIn} onMouseOut={hoverOut}>
        Sign in to claim <ArrowRight size={17} />
      </button>
    </div>
  )

  // ---- confirmed + authenticated: the hook ----
  const firstName = (profile?.full_name || user.user_metadata?.full_name || '').split(' ')[0]
  return shell(
    <div style={{ maxWidth: '440px', margin: '0 auto', width: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '52px', height: '52px', margin: '0 auto', borderRadius: '50%', border: `1px solid ${SILVER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 26px rgba(199,201,209,.22)' }}>
          <Check size={22} style={{ color: STAR }} />
        </div>
        <div style={{ marginTop: '18px' }}><Kicker>{live?.name || 'Ran By Artists'}{ticket && live?.editionNumber ? ` · ${live.editionNumber}` : ''}</Kicker></div>
        <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(40px,13vw,56px)', lineHeight: .88, margin: '12px 0 0', ...chromeText }}>
          {firstName ? `YOU'RE IN, ${firstName.toUpperCase()}` : "YOU'RE IN"}
        </h1>
        <p style={{ fontFamily: 'DM Sans', fontSize: '15px', color: BONE_MID, lineHeight: 1.65, margin: '18px auto 0', maxWidth: '360px' }}>
          {hasWorld
            ? 'Your ticket is confirmed and tied to your world. Add to it before the night — the room will see it.'
            : 'Your ticket is confirmed. Now build your world — a personal museum of your sound, your work, your influences. It’s how the room finds you.'}
        </p>
      </div>

      {/* ticket chip */}
      {ticket && (
        <div style={{ marginTop: '26px', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', border: `1px solid ${HAIR_HI}`, borderRadius: '14px', background: 'rgba(199,201,209,.04)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: STAR, boxShadow: '0 0 8px rgba(232,233,237,.7)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.2em' }}>CONFIRMED</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: '12px', color: BONE, letterSpacing: '.04em', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.qr_code}</div>
          </div>
          {typeof ticket.price_paid === 'number' && (
            <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_LOW }}>${(ticket.price_paid / 100).toFixed(0)} PAID</span>
          )}
        </div>
      )}

      {/* the hook — build/open your world */}
      <button onClick={() => navigate('/profile')} style={{ ...ctaStyle, marginTop: '22px', width: '100%' }} onMouseOver={hoverIn} onMouseOut={hoverOut}>
        {hasWorld ? 'Open your world' : 'Build your world'} <ArrowRight size={18} />
      </button>

      {!hasWorld && (
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '9px', justifyContent: 'center' }}>
          <Sparkles size={13} style={{ color: SILVER }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: '9.5px', color: BONE_LOW, letterSpacing: '.14em', textTransform: 'uppercase' }}>Takes two minutes · paste a link, it comes alive</span>
        </div>
      )}

      <button onClick={() => navigate('/')} style={{ display: 'block', margin: '22px auto 0', background: 'none', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.1em', cursor: 'pointer' }}>
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
