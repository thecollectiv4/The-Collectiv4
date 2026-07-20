import { useState } from 'react'
import CreateCentral from '@/components/CreateCentral'
import { BONE, BONE_LOW, FAINT, HAIR, FONT_DISPLAY, FONT_MONO, FONT_SANS } from '@/lib/cosmos'

/* =========================================================================
   /__create — DEV-ONLY. Mounts CREATE CENTRAL directly with a mock user so
   the flow can be judged on a real phone WITHOUT a session. The modal is
   normally reachable only behind `createOpen && user` in Layout, which made
   the app's most important screen the hardest one to look at.

   The `verified` toggle matters: an unverified member does NOT see HOST AN
   EVENT (honest absence, Leyes 9/11), so the menu has a different shape for
   almost everyone than it does for the founders. Both are worth seeing.
   ========================================================================= */

export default function CreateHarness() {
  const [open, setOpen] = useState(true)
  const [verified, setVerified] = useState(false)

  const btn = (on) => ({
    background: on ? BONE : 'transparent', color: on ? 'var(--bg)' : BONE,
    border: `1px solid ${on ? BONE : HAIR}`, borderRadius: '4px',
    padding: '10px 16px', fontFamily: FONT_MONO, fontSize: '10px',
    letterSpacing: '.18em', textTransform: 'uppercase', cursor: 'pointer',
  })

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', position: 'relative', zIndex: 1, padding: '40px 24px' }}>
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.3em', textTransform: 'uppercase', color: BONE_LOW }}>
          ◇&nbsp;&nbsp;dev harness · create central
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 'clamp(30px,8vw,42px)', color: BONE, letterSpacing: '.02em', margin: '12px 0 0', lineHeight: 1 }}>
          THE CREATE FLOW
        </h1>
        <p style={{ fontFamily: FONT_SANS, fontSize: '13.5px', lineHeight: 1.65, color: FAINT, marginTop: '12px', maxWidth: '56ch' }}>
          The real component, mock session. Toggle verified to see the difference an
          unverified member sees — HOST AN EVENT is absent for them by design.
        </p>
        {/* zIndex above the modal's own backdrop (10005) — otherwise these
            controls are unreachable the moment the sheet is open, which is
            exactly when you want to flip verified and watch the menu change. */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '22px', flexWrap: 'wrap', position: 'relative', zIndex: 10010 }}>
          <button style={btn(open)} onClick={() => setOpen(true)}>Open create</button>
          <button style={btn(verified)} onClick={() => setVerified(v => !v)}>
            {verified ? 'verified member' : 'unverified member'}
          </button>
        </div>
      </div>

      {open && (
        <CreateCentral
          user={{ id: '00000000-0000-0000-0000-000000000000', email: 'harness@local' }}
          isMemberVerified={verified}
          devForceReady
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
