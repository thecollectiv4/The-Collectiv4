import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import Mark from './Mark'

/* =========================================================================
   GlassNav (v11) — the bottom tab bar as an Apple-style liquid-glass slab.

   VISUAL ONLY. Extracted verbatim from Layout.jsx: the tab list, the routes,
   the auth gating, the CREATE door and the bell count all still live in
   Layout and arrive here as props. Nothing about WHERE a tap goes changed —
   only how the bar looks while you tap it.

   The bar floats free of the screen edges (pill corners, 344px cap) and the
   page scrolls UNDER it, so the glass has something to refract (apple-design
   §12: translucent chrome is a layer, not an opaque strip that eats a band
   of the viewport).

   THE GLASS, in layers, back to front:
     1. blur + saturate backdrop        — the material itself
     2. vertical tint gradient          — thickness (lighter top, denser floor)
     3. inner top sheen                 — light pooling under the top edge
     4. 1px top edge glow               — the lit rim where light catches
     5. inset/outset shadow stack       — the slab reads as physically raised
     6. the indicator chip              — its own smaller, brighter glass
     7. SVG displacement refraction     — Chrome/Edge only, see below

   WHY 7 IS CONDITIONAL: `backdrop-filter: url(#svg-filter)` does not work in
   WebKit — open bug since 2022 (bugs.webkit.org 245510). Safari on iPhone,
   which is the entire audience here, ignores it. So the real refraction is a
   progressive enhancement behind a runtime feature test, and layers 1-6 (all
   of which WebKit ships) carry the look on their own. On Safari this reads as
   glass; on Chrome the chip rim additionally bends what's behind it.
   ========================================================================= */

const BONE = '#F2EEE6'
const REFRACTION_ID = 'c4-glass-refraction'

/* The house curve for the chip: a long, settled glide with no overshoot —
   the tab bar is not a toy, it does not bounce (apple-design §4: reserve
   bounce for motion the hand actually threw). */
const CHIP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const CHIP_MS = 620

/* Chrome/Edge support SVG filters inside backdrop-filter; WebKit and Firefox
   do not. Probed once, at module scope — the answer cannot change mid-session.
   Guarded for SSR/older engines: a missing CSS.supports means "no", never a
   crash, and layers 1-6 still render. */
const SUPPORTS_BACKDROP_SVG = (() => {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false
  const ref = `url(#${REFRACTION_ID})`
  try {
    return CSS.supports('backdrop-filter', ref) || CSS.supports('-webkit-backdrop-filter', ref)
  } catch { return false }
})()

const CREATE_SLOT = { create: true }

export default function GlassNav({ tabs, currentIdx, bellCount, onTab, onCreate }) {
  /* CREATE keeps the GEOMETRIC center it had before: the same `mid` split
     Layout used, so a fifth tab (OS members) still can't shove the + off-axis. */
  const mid = Math.ceil(tabs.length / 2)
  const slots = [...tabs.slice(0, mid), CREATE_SLOT, ...tabs.slice(mid)]
  const n = slots.length

  /* Where the chip parks. currentIdx is -1 on a sub-page (/messages/:id) —
     there the chip fades out rather than lying about which room you're in. */
  const activeSlot = currentIdx < 0 ? null : (currentIdx < mid ? currentIdx : currentIdx + 1)

  /* The chip must not glide in from slot 0 on first paint — it belongs under
     the current tab immediately, and only ANIMATES on taps after that. */
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <>
      {/* The refraction kernel. Inert and weightless when unsupported — it is
          only ever REFERENCED behind the feature test below. */}
      <svg aria-hidden="true" focusable="false"
        style={{ position:'absolute', width:0, height:0, overflow:'hidden', pointerEvents:'none' }}>
        <defs>
          <filter id={REFRACTION_ID} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.016" numOctaves="2" seed="11" result="turb" />
            <feGaussianBlur in="turb" stdDeviation="1.4" result="soft" />
            <feDisplacementMap in="SourceGraphic" in2="soft" scale="14" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* Positioner: spans the viewport so the bar centers on SCREEN, not
          inside the 430px body frame. pointer-events:none lets taps fall
          through the void on either side of the floating slab. */}
      <div className="glass-nav-dock" style={{
        position:'fixed', left:0, right:0, zIndex:9999,
        bottom:'calc(12px + env(safe-area-inset-bottom, 0px))',
        display:'flex', justifyContent:'center', padding:'0 16px',
        pointerEvents:'none',
      }}>
        <nav className="glass-nav" style={{
          pointerEvents:'auto',
          position:'relative', width:'100%', maxWidth:'344px',
          borderRadius:'34px', padding:'10px 8px 12px', overflow:'visible',
          background:'linear-gradient(180deg, rgba(30,31,40,0.44) 0%, rgba(12,12,17,0.56) 100%)',
          WebkitBackdropFilter:'blur(46px) saturate(185%)',
          backdropFilter:'blur(46px) saturate(185%)',
          border:'1px solid rgba(242,238,230,0.10)',
          boxShadow:'0 26px 54px rgba(0,0,0,0.58), 0 8px 20px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(242,238,230,0.16), inset 0 24px 34px -26px rgba(242,238,230,0.18)',
        }}>
          {/* inner top sheen — light pooling just under the lid */}
          <div aria-hidden="true" style={{
            position:'absolute', inset:'1px 1px auto 1px', height:'52%',
            borderRadius:'33px 33px 40px 40px', pointerEvents:'none',
            background:'linear-gradient(180deg, rgba(242,238,230,0.10) 0%, rgba(242,238,230,0.03) 40%, transparent 100%)',
          }} />
          {/* top edge glow — the lit rim, fading out before the corners */}
          <div aria-hidden="true" style={{
            position:'absolute', top:0, left:'12%', right:'12%', height:'1px', pointerEvents:'none',
            background:'linear-gradient(90deg, transparent, rgba(242,238,230,0.65), transparent)',
          }} />

          <div style={{ position:'relative', display:'flex', alignItems:'stretch' }}>
            {/* THE CHIP — the sliding pane of brighter glass. Rides on
                transform alone (compositor-friendly, apple-design §11). */}
            <div aria-hidden="true" className="glass-nav-chip" style={{
              position:'absolute', top:0, bottom:0, left:0,
              /* zIndex 0 against the slots' zIndex 1 is LOAD-BEARING: an
                 absolutely-positioned element paints above in-flow siblings
                 regardless of DOM order, so without this the chip's gradient
                 washes over the very icon and label it is meant to sit behind
                 (the active label came out dimmer than the inactive ones). */
              zIndex:0,
              width:`${100 / n}%`, borderRadius:'20px', pointerEvents:'none',
              transform:`translateX(${(activeSlot ?? 0) * 100}%)`,
              opacity: activeSlot === null ? 0 : 1,
              background:'linear-gradient(180deg, rgba(242,238,230,0.20), rgba(242,238,230,0.08), rgba(10,10,13,0.10))',
              border:'1px solid rgba(242,238,230,0.22)',
              boxShadow:'inset 0 1.5px 1px rgba(255,255,255,0.45), inset 0 -6px 10px -4px rgba(0,0,0,0.5), 0 6px 16px rgba(0,0,0,0.38)',
              /* Chrome/Edge only — the rim bends the page behind it. Safari
                 skips straight to the gradients above, which is why they carry
                 the full specular read on their own. */
              ...(SUPPORTS_BACKDROP_SVG ? {
                backdropFilter:`url(#${REFRACTION_ID}) blur(1px)`,
                WebkitBackdropFilter:`url(#${REFRACTION_ID}) blur(1px)`,
              } : null),
              transition: armed
                ? `transform ${CHIP_MS}ms ${CHIP_EASE}, opacity 400ms ${CHIP_EASE}`
                : 'none',
              willChange:'transform',
            }} />

            {slots.map((slot, i) => {
              if (slot.create) {
                return (
                  <button key="create" className="pressable glass-nav-slot" onClick={onCreate} aria-label="Create"
                    style={{ flex:1, minWidth:0, background:'transparent', border:'none', cursor:'pointer',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:'5px', padding:'4px 2px',
                      WebkitTapHighlightColor:'transparent', color: BONE,
                      position:'relative', zIndex:1 }}>
                    {/* Same footprint as every other slot — CREATE earns its
                        distinction from the bone ring and the brighter glass,
                        never from size (a raised blob would break the row). */}
                    <span aria-hidden="true" style={{
                      width:'36px', height:'36px', borderRadius:'13px',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      background:'linear-gradient(180deg, rgba(242,238,230,0.20), rgba(242,238,230,0.07))',
                      border:`1px solid rgba(242,238,230,0.55)`,
                      boxShadow:'inset 0 1px 0.5px rgba(255,255,255,0.4), 0 4px 12px rgba(0,0,0,0.35)',
                    }}>
                      <Plus size={19} strokeWidth={2} />
                    </span>
                    <span className="glass-nav-label" style={{ color: BONE }}>Create</span>
                  </button>
                )
              }

              const active = i === activeSlot
              return (
                <div key={slot.to} className="pressable glass-nav-slot" onClick={() => onTab(slot)}
                  style={{ flex:1, minWidth:0, cursor:'pointer', display:'flex', flexDirection:'column',
                    alignItems:'center', gap:'5px', padding:'4px 2px',
                    WebkitTapHighlightColor:'transparent', position:'relative', zIndex:1,
                    /* opacity is the ONLY active/inactive signal (per the
                       reference: 1 vs .42) — the timing lives in the
                       .glass-nav-slot rule so it can share one transition
                       list with the press settle. */
                    color: BONE, opacity: active ? 1 : 0.42 }}>
                  <span style={{ position:'relative', display:'flex', alignItems:'center',
                    justifyContent:'center', width:'36px', height:'36px' }}>
                    {/* the house marks stay the house marks (Ley 14) — the
                        glass is a new skin over the same star chart. */}
                    <Mark type={slot.mark} size={22} filled={active} color={BONE} />
                    {slot.to === '/messages' && bellCount > 0 && (
                      <span data-testid="bell-badge" className="badge-in" aria-label={`${bellCount} unread signals`}
                        style={{ position:'absolute', top:'2px', right:'2px', minWidth:'14px', height:'14px',
                          borderRadius:'100px', background: BONE, color:'#0A0A0D', fontFamily:'DM Mono',
                          fontSize:'8.5px', fontWeight:700, lineHeight:'14px', textAlign:'center',
                          padding:'0 3px', letterSpacing:0,
                          boxShadow:'0 0 0 2px rgba(12,12,17,0.55)' }}>
                        {bellCount > 9 ? '9+' : bellCount}
                      </span>
                    )}
                  </span>
                  <span className="glass-nav-label">{slot.label}</span>
                </div>
              )
            })}
          </div>
        </nav>
      </div>
    </>
  )
}
