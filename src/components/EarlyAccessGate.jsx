import { useEffect, useRef, useState } from 'react'
import {
  BONE, BONE_MID, BONE_LOW, FAINT, HAIR, HAIR_HI,
  FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText, EASE_HOUSE,
} from '@/lib/cosmos'
import { useWide } from '@/lib/useIsDesktop'
import { normalizeCode, isCodeComplete, checkInviteCode } from '@/lib/earlyAccess'

/* =========================================================================
   LA PUERTA — the early-access screen.

   THE BRIEF: "la puerta se abre para pocos." It has to feel exclusive and
   DESIRABLE, never like a rejection. A wall says go away; a door says you
   are almost there. Everything below is built for the second reading.

   THE LAW IT OBEYS:
   • Ley 8 — ONE chrome moment per screen. It is the headline. Nothing
     else on this page is allowed to shine.
   • La Ley del Lujo Inmersivo — luxury is LESS, better placed. One element
     commands (the headline), everything else whispers. Air is the feature.
   • Ley 9 — every click keeps its promise. "No code yet" opens a real
     message to a real inbox; sign-in is always reachable. No dead ends.
   • Ley 2 — one question in three seconds: what is this, and how do I get
     in? Kicker, headline, one field. Nothing else competes.

   THE ESCAPE HATCH IS LOAD-BEARING: this gate stands in front of SIGNUP,
   never in front of sign-in. An existing member who lands here must always
   see a way to their account in one tap — the day this ships, every member
   the platform already has is on the wrong side of this screen.
   ========================================================================= */

const REDUCED = () => typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function EarlyAccessGate({ onAccepted, onSignIn }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [enter, setEnter] = useState(REDUCED())   // reduced-motion: land composed, not blank
  const inputRef = useRef(null)
  const wide = useWide()

  useEffect(() => {
    if (REDUCED()) return undefined
    const t = setTimeout(() => setEnter(true), 40)
    return () => clearTimeout(t)
  }, [])

  /* THE DOOR WAS 430px WIDE ON A MAC. index.css puts `max-width:430px` on
     BODY — the phone frame — and only Layout ever releases it (body.wide-full).
     This route renders OUTSIDE Layout (App.jsx), so the frame never lifted and
     the component's own maxWidth was dead code behind it. The first screen a
     new member ever sees was a phone strip in a black desert, on the exact
     device the launch statement gets opened from. Same mechanism Layout uses,
     so there is one way to release the frame, not two. */
  useEffect(() => {
    document.body.classList.add('wide-full')
    return () => document.body.classList.remove('wide-full')
  }, [])

  const complete = isCodeComplete(code)

  const submit = async () => {
    if (!complete || checking) return
    setChecking(true); setError('')
    const { valid, checked } = await checkInviteCode(code)
    setChecking(false)
    // `checked === false` means we couldn't reach the oracle. Let it through
    // and let the server-side hook be the one to refuse — never strand a
    // real invitee on a network hiccup.
    if (valid || !checked) { onAccepted(normalizeCode(code)); return }
    setError("That code isn't open. Check it, or ask whoever invited you for a new one.")
  }

  // the one moment of light on the page: the field wakes as the code completes
  const fieldBorder = error ? 'rgba(229,160,160,.5)' : complete ? 'rgba(var(--ink-rgb),.42)' : HAIR_HI

  const rise = (d) => ({
    opacity: enter ? 1 : 0,
    transform: enter ? 'translateY(0)' : 'translateY(10px)',
    transition: REDUCED() ? 'none' : `opacity .8s ${EASE_HOUSE} ${d}ms, transform .8s ${EASE_HOUSE} ${d}ms`,
  })

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: wide ? '80px 40px' : '48px 28px', background: 'transparent',
      position: 'relative', zIndex: 1, textAlign: 'center',
    }}>
      {/* A door is a focal moment, so it stays ONE centred column even on a
          wide screen — the fix is not a second column, it is letting the
          column and its type reach the scale of the screen they are on. */}
      <div style={{ width: '100%', maxWidth: wide ? '620px' : '440px' }}>

        {/* kicker — the star-chart mark doing the job the design system
            actually assigns it: a section marker, not a destination */}
        <div style={{ ...rise(0), fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>
          ◇&nbsp;&nbsp;Early Access
        </div>

        {/* THE chrome moment. Nothing else on this screen shines. */}
        <h1 style={{
          ...rise(90), ...chromeText,
          fontFamily: FONT_DISPLAY, fontWeight: 400,
          // the headline has to COMMAND the screen it is on; 60px was the
          // phone ceiling and read timid across a laptop
          fontSize: wide ? 'clamp(60px, 6vw, 88px)' : 'clamp(40px, 12vw, 60px)',
          lineHeight: 0.94,
          letterSpacing: '.015em', margin: wide ? '30px 0 0' : '22px 0 0',
        }}>
          NOT FOR<br />ALL PEOPLE
        </h1>

        <p style={{
          ...rise(170), fontFamily: FONT_SANS, fontSize: wide ? '15.5px' : '14px', lineHeight: 1.68,
          color: BONE_MID, margin: wide ? '28px auto 0' : '24px auto 0', maxWidth: '34ch',
          // balance kills the one-word orphan line; wraps evenly or not at all
          textWrap: 'balance', textAlign: 'center',
        }}>
          The Collectiv4 opens one door at a time.
          Everyone inside was let in by someone already here.
        </p>

        {/* the field — 16px is not a taste call: below it, iOS Safari zooms
            the viewport on focus and the composition breaks on the phone */}
        <div style={{ ...rise(250), marginTop: '40px' }}>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => { setCode(normalizeCode(e.target.value)); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="C4-XXXX-XXXX"
            aria-label="Invitation code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            style={{
              width: '100%', background: 'rgba(var(--ink-rgb),.022)',
              border: `1px solid ${fieldBorder}`, borderRadius: '4px',
              padding: '18px 16px', textAlign: 'center',
              fontFamily: FONT_MONO, fontSize: '16px', letterSpacing: '.22em',
              color: BONE, outline: 'none', caretColor: BONE,
              transition: `border-color .35s ${EASE_HOUSE}, background .35s ${EASE_HOUSE}`,
            }}
          />
          <div style={{ marginTop: '10px', fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.24em', textTransform: 'uppercase', color: error ? 'var(--warn)' : FAINT, minHeight: '14px', transition: `color .3s ${EASE_HOUSE}` }}>
            {error ? '' : 'Invitation code'}
          </div>
          {error && (
            <div style={{ fontFamily: FONT_SANS, fontSize: '12.5px', lineHeight: 1.55, color: 'var(--warn)', marginTop: '2px', maxWidth: '32ch', marginInline: 'auto' }}>
              {error}
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={!complete || checking}
          style={{
            ...rise(320), width: '100%', marginTop: '18px',
            background: complete ? BONE : 'rgba(var(--ink-rgb),.06)',
            color: complete ? 'var(--bg)' : BONE_LOW,
            border: complete ? 'none' : `1px solid ${HAIR}`,
            borderRadius: '4px', padding: '17px',
            fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '.22em',
            textTransform: 'uppercase', fontWeight: 500,
            cursor: complete && !checking ? 'pointer' : 'default',
            opacity: checking ? 0.6 : 1,
            transition: `background .4s ${EASE_HOUSE}, color .4s ${EASE_HOUSE}, opacity .25s`,
          }}>
          {checking ? 'Opening…' : 'Open the door'}
        </button>

        {/* THE ESCAPE HATCH — every existing member lands on the wrong side
            of this screen the day it ships. This is how they get home. */}
        <div style={{ ...rise(390), marginTop: '38px', paddingTop: '26px', borderTop: `1px solid ${HAIR}` }}>
          <button onClick={onSignIn} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT_SANS, fontSize: '13px', color: BONE_MID, padding: '6px' }}>
            Already one of us? <span style={{ color: BONE, textDecoration: 'underline', textUnderlineOffset: '3px' }}>Sign in</span>
          </button>

          <div style={{ marginTop: '14px' }}>
            <a
              href="mailto:thecollectiv4@gmail.com?subject=Early%20access%20—%20who%20I%20am&body=Tell%20us%20who%20you%20are%2C%20what%20you%20make%2C%20and%20who%20you%20know%20in%20the%20room.%0A%0A"
              style={{ fontFamily: FONT_SANS, fontSize: '13px', color: BONE_LOW, textDecoration: 'none' }}>
              No code yet? <span style={{ color: BONE_MID, textDecoration: 'underline', textUnderlineOffset: '3px' }}>Tell us who you are&nbsp;→</span>
            </a>
          </div>
        </div>

        {/* both founders, always (canon) */}
        <div style={{ ...rise(460), marginTop: '44px', fontFamily: FONT_MONO, fontSize: '8.5px', letterSpacing: '.26em', textTransform: 'uppercase', color: FAINT }}>
          Pato Durán &amp; Diego Villaseñor · Founders
        </div>
      </div>
    </div>
  )
}
