import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import Mark from './Mark'

/* =========================================================================
   GlassNav (v11) — the bottom tab bar as an Apple-style liquid-glass slab.

   VISUAL ONLY. The tab list, the routes, the auth gating, the CREATE door
   and the bell count all live in Layout and arrive here as props.

   ─── the Instagram round ──────────────────────────────────────────────

   RETRACT ON SCROLL. Scrolling down folds the bar away; scrolling up — or
   simply stopping — brings it back. The transform rides on the DOCK, never
   on the slab: `transform` is NOT one of the things that creates a backdrop
   root (that list is filter, opacity<1, mask, clip-path, mix-blend-mode and
   the root element), so moving the wrapper leaves the glass sampling the
   page exactly as before. Transforming the backdrop-filtered element itself
   is the variant with open WebKit bugs — so we don't.

   THE CHIP GLIDE IS 380ms, NOT 620ms. Measured on the running app: React
   writes the chip's new position 27ms after the finger lands, and the node
   is reused (no remount) — the machinery was never broken. But the page
   swaps instantly while a 620ms chip was still crawling toward its slot,
   which reads as "it didn't respond". 380ms lands inside Apple's 0.3-0.4s
   response band and the two now finish together.

   NO SWIPE-TO-SWITCH. See the note above the pointer handlers — it was
   evaluated and deliberately not shipped.

   FIVE SLOTS, ALWAYS. OS moved to the Profile screen, so the row is a fixed
   EVENT · COMMUNITY · CREATE · MESSAGES · PROFILE. Equal flex, identical
   icon boxes, identical gaps — the bar can no longer reflow under the user.
   ========================================================================= */

const BONE = '#F2EEE6'

/* Apple's response band for a control the hand is waiting on (0.3-0.4s),
   with the house curve. No overshoot — a tab bar is not a toy. */
const CHIP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const CHIP_MS = 380

/* The retract uses the house curve Diego asked for. */
const HOUSE_EASE = 'cubic-bezier(.2, .7, .2, 1)'
const RETRACT_MS = 420

/* Literal values only — WebKit silently drops backdrop-filter when any part
   of the chain comes from a CSS custom property (bug 289800). */
const GLASS = 'saturate(180%) contrast(0.92) brightness(1.08) blur(28px)'

/* Clearance over iOS Safari's collapsed-toolbar band. env() reports 0 in that
   state, so this constant IS the whole clearance. Layout's runway, the
   Messages composer and the Drops button all derive from it. */
const DOCK_BOTTOM = 'calc(36px + env(safe-area-inset-bottom, 0px))'

const ICON = 22        // every mark, and the +, at one size (symmetry)
const SLOT_BOX = 36    // every icon box identical, so gaps are identical

const CREATE_SLOT = { create: true }

/* ── retract-on-scroll ───────────────────────────────────────────────────
   Down folds it away, up brings it back, and going quiet brings it back too.

   Two things this has to survive on iOS: rubber-band overscroll, where
   scrollY runs negative at the top and past the maximum at the bottom (raw
   deltas there flip sign and would strobe the bar), and scroll events
   arriving faster than frames. So: clamp to the real scrollable range, batch
   in rAF, and require a real threshold of travel before believing a
   direction. */
function useRetractOnScroll(enabled) {
  const [retracted, setRetracted] = useState(false)

  useEffect(() => {
    if (!enabled) { setRetracted(false); return undefined }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined

    const THRESHOLD = 10   // px of honest travel before it counts as a direction
    const FLOOR = 72       // never fold away near the top of a page
    const IDLE_MS = 1400   // stopping counts as "come back"

    let last = window.scrollY
    let ticking = false
    let idle

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        const y = Math.min(Math.max(window.scrollY, 0), max)   // kill the bounce
        const dy = y - last
        if (Math.abs(dy) < THRESHOLD) return                   // accumulate, don't strobe
        last = y
        setRetracted(dy > 0 && y > FLOOR)
        clearTimeout(idle)
        idle = setTimeout(() => setRetracted(false), IDLE_MS)
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(idle) }
  }, [enabled])

  return retracted
}

export default function GlassNav({ tabs, currentIdx, bellCount, onTab, onCreate }) {
  /* CREATE keeps the geometric center: the same `mid` split Layout used. With
     OS gone this is always 4 tabs → 5 slots, but the split still computes so
     the bar stays correct if a tab is ever added back. */
  const mid = Math.ceil(tabs.length / 2)
  const slots = [...tabs.slice(0, mid), CREATE_SLOT, ...tabs.slice(mid)]
  const n = slots.length

  /* currentIdx is -1 on a sub-page (/messages/:id) — there the chip fades out
     rather than lying about which room you're in. */
  const activeSlot = currentIdx < 0 ? null : (currentIdx < mid ? currentIdx : currentIdx + 1)

  /* The chip must not glide in from slot 0 on first paint — it belongs under
     the current tab immediately, and only ANIMATES on taps after that. */
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const retracted = useRetractOnScroll(armed)

  /* Any tap wakes the bar: if a finger reaches a folded bar mid-scroll, it
     should come back rather than swallow the touch. Belt-and-braces — the
     dock also drops pointer-events while folded. */
  const wake = useRef(null)

  return (
    /* THE DOCK — spans the viewport so the bar centers on SCREEN, not inside
       the 430px body frame, and carries the retract transform (no
       backdrop-filter here, so nothing about the glass is disturbed).

       zIndex STAYS 9999. Every overlay that must cover the bar sits at 10000
       (AuthModal, WorldBuilder, the OS sheet) or above, and AuthModal is NOT
       portaled — it renders earlier in Layout's tree, so at an equal z-index
       the bar would paint OVER the sign-in modal. */
    <div className="glass-nav-dock" ref={wake} style={{
      position:'fixed', left:0, right:0, zIndex:9999,
      bottom: DOCK_BOTTOM,
      display:'flex', justifyContent:'center', padding:'0 16px',
      pointerEvents:'none',
      transformOrigin:'bottom center',
      transform: retracted ? 'translateY(calc(100% + 36px)) scale(0.88)' : 'translateY(0) scale(1)',
      opacity: retracted ? 0 : 1,
      transition: armed
        ? `transform ${RETRACT_MS}ms ${HOUSE_EASE}, opacity ${Math.round(RETRACT_MS * 0.7)}ms ${HOUSE_EASE}`
        : 'none',
      willChange:'transform',
    }}>
      <nav className="glass-nav" aria-hidden={retracted || undefined} style={{
        /* a folded bar must not catch a thumb it can't show */
        pointerEvents: retracted ? 'none' : 'auto',
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
          {/* THE CHIP — a pane of brighter glass, not a second blur (glass
              inside glass re-blurs the slab's own output, not the page).
              translateZ(0) keeps it on its own compositor layer.

              `width` is deliberately NOT in the transition list any more: the
              row is a fixed five slots now, so the width never changes and
              interpolating it was one property of pure overhead per glide. */}
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
            transition: armed
              ? `transform ${CHIP_MS}ms ${CHIP_EASE}, opacity ${CHIP_MS}ms ${CHIP_EASE}`
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
                  {/* Identical footprint to every other slot — CREATE earns its
                      distinction from the bone ring and the brighter glass,
                      never from size. */}
                  <span aria-hidden="true" style={{
                    width:`${SLOT_BOX}px`, height:`${SLOT_BOX}px`, borderRadius:'13px',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:'linear-gradient(180deg, rgba(242,238,230,0.22), rgba(242,238,230,0.07))',
                    border:'1px solid rgba(242,238,230,0.58)',
                    boxShadow:'inset 0 1px 0.5px rgba(255,255,255,0.45), 0 4px 12px rgba(0,0,0,0.35)',
                  }}>
                    <Plus size={ICON} strokeWidth={1.9} />
                  </span>
                  <span className="glass-nav-label" style={{ color: BONE }}>Create</span>
                </button>
              )
            }

            const active = i === activeSlot
            return (
              /* A REAL <button>: iOS only gives native activation to
                 interactive elements, and a div's tap dies on finger drift.

                 NO onPointerDown/onTouchStart routing here on purpose. A
                 swipe-over-the-bar gesture was evaluated and rejected: on
                 WebKit the synthesized click cannot be cancelled from any
                 pointer event (per spec, `click` is not a compatibility mouse
                 event), so a gesture recognizer would need a capture-phase
                 click trap on a timing window — and with the bar now
                 translating during retract, the synthesized click can hit-test
                 to a DIFFERENT tab than the finger started on. Competing with
                 tap is exactly the wrong trade when unreliable tap is the bug
                 being fixed. */
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
                  justifyContent:'center', width:`${SLOT_BOX}px`, height:`${SLOT_BOX}px` }}>
                  {/* the house marks stay the house marks (Ley 14) */}
                  <Mark type={slot.mark} size={ICON} filled={active} color={BONE} />
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
