import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import Mark from './Mark'

/* =========================================================================
   GlassNav (v11) — the bottom tab bar as an Apple-style liquid-glass slab.

   VISUAL ONLY. The tab list, the routes, the auth gating, the CREATE door
   and the bell count all live in Layout and arrive here as props. Nothing
   about WHERE a tap goes changed — only how the bar looks and how reliably
   it catches a thumb.

   ─── what the iPhone round taught us ──────────────────────────────────

   1. THE BAR SAT TOO LOW. At 12px it landed inside the band iOS Safari
      reserves for re-expanding its own collapsed toolbar, so after any
      scroll a tap grew the browser chrome instead of reaching the tab.
      That is the "the slide doesn't respond" bug. It now clears at 28px.

   2. THE SLOTS WERE DIVS. iOS only gives native activation to real
      interactive elements; a div's synthesized click is discarded if the
      finger drifts. CREATE (a <button>) always worked — that asymmetry was
      the tell. Every slot is a <button> now.

   3. GLASS INSIDE GLASS IS NOT GLASS. An element with backdrop-filter is
      itself a backdrop root, so a blurred chip nested in a blurred bar
      re-blurs the BAR's output instead of the page — a muddy grey patch,
      never glass. The chip carries no backdrop-filter at all now: tint,
      hairline and specular only. That is what actually reads as a pane of
      brighter glass resting on the slab.

   4. MORE BLUR IS NOT MORE GLASS. Past ~24-30px the backdrop is already
      featureless, so the radius only buys GPU cost (the kernel runs in
      DEVICE pixels — 28px is an 84px kernel on a 3x iPhone). The depth
      comes from the colour pass and the EDGE: saturation restores the
      chroma the blur ate, a brightness lift and contrast pull give it
      body, and a top-lit hairline over a dark inner floor reads as a real
      lit facet. Colour ops run BEFORE the blur so they act on unblurred
      pixels — filter order is load-bearing.

   The page scrolls UNDER the slab so the glass has something live to
   refract (apple-design §12: translucent chrome is a layer, not an opaque
   strip that eats a band of the viewport).
   ========================================================================= */

const BONE = '#F2EEE6'

/* The house curve for the chip: a long, settled glide with no overshoot —
   the tab bar is not a toy, it does not bounce (apple-design §4). */
const CHIP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const CHIP_MS = 620

/* Literal values only — WebKit silently drops backdrop-filter when any part
   of the chain comes from a CSS custom property (bug 289800), and DevTools
   still shows the property as applied. Never var() in here. */
const GLASS = 'saturate(180%) contrast(0.92) brightness(1.08) blur(28px)'

/* Clearance over iOS Safari's collapsed-toolbar reveal band. env() reports 0
   in that collapsed state, so this constant IS the whole clearance — it is
   not decorative spacing. Layout's bottom runway is derived from it. */
const DOCK_BOTTOM = 'calc(28px + env(safe-area-inset-bottom, 0px))'

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
    /* Positioner: spans the viewport so the bar centers on SCREEN, not inside
       the 430px body frame. pointer-events:none lets taps fall through the
       void on either side of the floating slab.

       zIndex STAYS 9999 — do not "harden" it to 10000. Every overlay that
       must cover the bar sits at exactly 10000 (AuthModal, WorldBuilder, the
       OS sheet) or above (CreateCentral 10005, the museum dialog 10010), and
       AuthModal is NOT portaled: it renders earlier in Layout's own tree, so
       at an equal z-index the bar would paint OVER the sign-in modal. The
       Messages scrim ties at 9999 but is portaled to document.body, landing
       after #root — it wins the tie, which is the behaviour we want. */
    <div className="glass-nav-dock" style={{
      position:'fixed', left:0, right:0, zIndex:9999,
      bottom: DOCK_BOTTOM,
      display:'flex', justifyContent:'center', padding:'0 16px',
      pointerEvents:'none',
    }}>
      <nav className="glass-nav" style={{
        pointerEvents:'auto',
        position:'relative', width:'100%', maxWidth:'344px',
        borderRadius:'34px', padding:'10px 8px 12px', overflow:'visible',
        background:'linear-gradient(180deg, rgba(30,31,40,0.42) 0%, rgba(12,12,17,0.56) 100%)',
        WebkitBackdropFilter: GLASS,
        backdropFilter: GLASS,
        /* the lit top facet over a dark inner floor — this pair, not the
           blur, is what the eye reads as thickness */
        border:'1px solid rgba(242,238,230,0.12)',
        boxShadow:[
          '0 26px 54px rgba(0,0,0,0.60)',
          '0 8px 20px rgba(0,0,0,0.45)',
          'inset 0 1.5px 0 rgba(242,238,230,0.22)',
          'inset 0 -1px 0 rgba(7,8,14,0.55)',
          'inset 0 26px 36px -26px rgba(242,238,230,0.22)',
        ].join(', '),
      }}>
        {/* inner top sheen — light pooling just under the lid. Pure gradient:
            a backdrop-filter here would make it a backdrop root over its own
            parent and sever the blur beneath it. */}
        <div aria-hidden="true" style={{
          position:'absolute', inset:'1px 1px auto 1px', height:'52%',
          borderRadius:'33px 33px 40px 40px', pointerEvents:'none',
          background:'linear-gradient(180deg, rgba(242,238,230,0.13) 0%, rgba(242,238,230,0.04) 40%, transparent 100%)',
        }} />
        {/* top edge glow — the lit rim, fading out before the corners */}
        <div aria-hidden="true" style={{
          position:'absolute', top:0, left:'12%', right:'12%', height:'1px', pointerEvents:'none',
          background:'linear-gradient(90deg, transparent, rgba(242,238,230,0.78), transparent)',
        }} />

        <div style={{ position:'relative', display:'flex', alignItems:'stretch' }}>
          {/* THE CHIP — a pane of brighter glass, NOT a second blur (see 3).
              Rides on transform alone; translateZ(0) keeps it on its own
              compositor layer so the slab beneath doesn't re-rasterize the
              whole 620ms glide. */}
          <div aria-hidden="true" className="glass-nav-chip" style={{
            position:'absolute', top:0, bottom:0, left:0,
            /* zIndex 0 against the slots' zIndex 1 is LOAD-BEARING: an
               absolutely-positioned element paints above in-flow siblings
               regardless of DOM order, so without this the chip's gradient
               washes over the very icon and label it sits behind. */
            zIndex:0,
            width:`${100 / n}%`, borderRadius:'20px', pointerEvents:'none',
            transform:`translateZ(0) translateX(${(activeSlot ?? 0) * 100}%)`,
            opacity: activeSlot === null ? 0 : 1,
            background:'linear-gradient(180deg, rgba(242,238,230,0.24), rgba(242,238,230,0.09), rgba(10,10,13,0.12))',
            border:'1px solid rgba(242,238,230,0.26)',
            boxShadow:'inset 0 1.5px 1px rgba(255,255,255,0.50), inset 0 -6px 10px -4px rgba(0,0,0,0.5), 0 6px 16px rgba(0,0,0,0.38)',
            /* width is IN the transition list on purpose: when OS access
               resolves, tabs go 4→5 and every slot narrows. Without it the
               chip snaps to a new size and position in the same frame. */
            transition: armed
              ? `transform ${CHIP_MS}ms ${CHIP_EASE}, width ${CHIP_MS}ms ${CHIP_EASE}, opacity 400ms ${CHIP_EASE}`
              : 'none',
            willChange:'transform',
          }} />

          {slots.map((slot, i) => {
            if (slot.create) {
              return (
                <button key="create" type="button" className="pressable glass-nav-slot" onClick={onCreate} aria-label="Create"
                  style={{ flex:1, minWidth:0, background:'transparent', border:'none', font:'inherit', cursor:'pointer',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:'5px', padding:'4px 2px',
                    WebkitTapHighlightColor:'transparent', color: BONE,
                    position:'relative', zIndex:1 }}>
                  {/* Same footprint as every other slot — CREATE earns its
                      distinction from the bone ring and the brighter glass,
                      never from size (a raised blob would break the row). */}
                  <span aria-hidden="true" style={{
                    width:'36px', height:'36px', borderRadius:'13px',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:'linear-gradient(180deg, rgba(242,238,230,0.22), rgba(242,238,230,0.07))',
                    border:'1px solid rgba(242,238,230,0.58)',
                    boxShadow:'inset 0 1px 0.5px rgba(255,255,255,0.45), 0 4px 12px rgba(0,0,0,0.35)',
                  }}>
                    <Plus size={19} strokeWidth={2} />
                  </span>
                  <span className="glass-nav-label" style={{ color: BONE }}>Create</span>
                </button>
              )
            }

            const active = i === activeSlot
            return (
              /* A REAL <button>, not a div: iOS Safari only gives native
                 activation to interactive elements, and a div's tap dies on a
                 few px of finger drift. Same handler, same route. */
              <button key={slot.to} type="button" className="pressable glass-nav-slot" onClick={() => onTab(slot)}
                aria-current={active ? 'page' : undefined}
                style={{ flex:1, minWidth:0, cursor:'pointer', display:'flex', flexDirection:'column',
                  alignItems:'center', gap:'5px', padding:'4px 2px',
                  background:'transparent', border:'none', font:'inherit',
                  WebkitTapHighlightColor:'transparent', position:'relative', zIndex:1,
                  /* opacity is the ONLY active/inactive signal (1 vs .42) —
                     the timing lives in the .glass-nav-slot rule so it can
                     share one transition list with the press settle. */
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
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
