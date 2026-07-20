import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import Mark from './Mark'
import { GLASS_FILTER, CHIP, BUBBLE, WELL, MARK_CHIP_RADIUS } from '@/lib/glass'

/* =========================================================================
   GlassNav (v11) — the bottom tab bar as an Apple-style liquid-glass slab.

   VISUAL ONLY. The tab list, the routes, the auth gating, the CREATE door
   and the bell count all live in Layout and arrive here as props.

   ─── THE SCRUB GESTURE ────────────────────────────────────────────────

   Press and hold a slot: it MAGNIFIES under the finger. Keep holding and
   slide sideways: the magnification hands off slot to slot, the glass chip
   travels with it, and the labels lift as they take focus. Release: you go
   wherever the finger ended.

   This replaces the earlier "flick sideways = next tab" reading, which was
   the wrong gesture — it moved one tab per flick and never told you where
   you were going. A scrub is a preview you can change your mind inside of,
   which is what makes it feel like iOS rather than like a carousel.

   Why it can be this simple: the bar already declares `touch-action: none`,
   so WebKit hands us the whole gesture at touchstart. There is no axis to
   classify, no directional lock to defeat, no fight with page scroll — the
   two earlier failures were both about reclaiming a gesture Safari had
   already taken. We never let it take one.

   A tap is just a scrub with no travel, so tap and drag are ONE code path
   and cannot disagree. The trailing synthesized click is swallowed by a
   capture-phase guard, because per spec `click` is not a compatibility mouse
   event and cannot be cancelled from any touch handler.

   ─── the rest ─────────────────────────────────────────────────────────

   RETRACT ON SCROLL rides on the DOCK, never on the slab: `transform` is not
   a backdrop-root trigger (that list is filter, opacity<1, mask, clip-path,
   mix-blend-mode and the root element), so moving the wrapper leaves the
   glass sampling the page. Transforming the backdrop-filtered element itself
   is the variant with open WebKit bugs.

   THE CHIP GLIDE IS 380ms. Measured: React writes the new position 27ms
   after the finger lands and the node is reused. The old 620ms was still
   crawling long after the page had swapped, which read as "it didn't
   respond". 380ms is inside Apple's 0.3-0.4s response band.

   FIVE SLOTS, ALWAYS — OS lives on the Profile screen now, so the row can
   never reflow under a thumb.
   ========================================================================= */

const BONE = '#F2EEE6'
/* la marca de una sala donde NO estás parado: gris frío, no hueso apagado.
   El mismo valor que usa la barra de escritorio, para que las dos digan
   "aquí no estás" con el mismo tono. */
const DIM = '#83838F'

const CHIP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const CHIP_MS = 380
const HOUSE_EASE = 'cubic-bezier(.2, .7, .2, 1)'
const RETRACT_MS = 420

/* While a finger is down the chip must not lag behind it — a preview that
   arrives late reads as broken. Short and house-curved. */
const SCRUB_MS = 190

const GLASS = GLASS_FILTER

/* Clearance over iOS Safari's collapsed-toolbar band. env() reports 0 in that
   state, so this constant IS the whole clearance. Layout's runway, the
   Messages composer and the Drops button all derive from it. */
const DOCK_BOTTOM = 'calc(14px + env(safe-area-inset-bottom, 0px))'

const ICON = 22
const SLOT_BOX = 36

const CREATE_SLOT = { create: true }

/* ── retract-on-scroll ─────────────────────────────────────────────────── */
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
        // iOS rubber-band runs scrollY negative at the top and past the max at
        // the bottom; raw deltas there flip sign and would strobe the bar.
        const y = Math.min(Math.max(window.scrollY, 0), max)
        const dy = y - last
        if (Math.abs(dy) < THRESHOLD) return
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

/* ── the scrub ───────────────────────────────────────────────────────────
   press → magnify · drag → hand off · release → go.

   The listener is bound by hand rather than through React props because
   React attaches touchmove PASSIVELY at the root: an onTouchMove prop can
   never preventDefault, so the call is a silent no-op. That single fact is
   why the first two gesture attempts died. */
function useBarScrub(navRef, rowRef, n, { onPreview, onCommit, enabled }) {
  const cb = useRef({ onPreview, onCommit })
  cb.current = { onPreview, onCommit }

  useEffect(() => {
    const el = navRef.current
    if (!el || !enabled || n <= 0) return undefined

    const GUARD_MS = 600
    let vivo = false, guard = 0, actual = -1

    /* Which slot the finger is over. Derived from the ROW's live box, so it
       stays correct through the retract scale and any viewport change — a
       cached slot width would drift the moment the bar transformed. */
    const slotEn = (clientX) => {
      const row = rowRef.current
      if (!row) return -1
      const r = row.getBoundingClientRect()
      if (r.width <= 0) return -1
      const i = Math.floor(((clientX - r.left) / r.width) * n)
      return Math.max(0, Math.min(n - 1, i))
    }

    /* Read the point from `touches`, strictly. A "tolerant" version that fell
       back to `changedTouches` and loosened the single-finger check was tried
       and REGRESSED WebKit from passing to dead — verified, then reverted.
       This is the shape that works on the engine the audience actually uses;
       do not soften it to make a non-target engine's synthetic events happy. */
    const start = (e) => {
      if (e.touches.length !== 1) { vivo = false; return }
      vivo = true
      actual = slotEn(e.touches[0].clientX)
      cb.current.onPreview(actual)
    }
    const move = (e) => {
      if (!vivo || e.touches.length !== 1) return
      // the bar is not a scroll surface; keep the gesture and the rubber-band
      // out of it for the whole drag
      if (e.cancelable) e.preventDefault()
      const i = slotEn(e.touches[0].clientX)
      if (i !== actual) { actual = i; cb.current.onPreview(i) }
    }
    const end = (e) => {
      if (!vivo) return
      vivo = false
      const x = e.changedTouches?.[0]?.clientX
      const i = x == null ? actual : slotEn(x)
      cb.current.onPreview(null)
      if (i < 0) return
      // the click that iOS synthesizes next would re-fire this same slot
      guard = performance.now() + GUARD_MS
      cb.current.onCommit(i)
    }
    /* iOS reports a gesture the system took over as touchcancel, and on that
       path it means "over", not "undo" — but committing a navigation the user
       may not have meant is the worse error, so cancel abandons quietly. */
    const cancel = () => { vivo = false; cb.current.onPreview(null) }
    const clickGuard = (e) => {
      if (performance.now() < guard) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      }
    }

    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })   // load-bearing
    el.addEventListener('touchend', end, { passive: true })
    el.addEventListener('touchcancel', cancel, { passive: true })
    el.addEventListener('click', clickGuard, true)               // capture phase
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', cancel)
      el.removeEventListener('click', clickGuard, true)
    }
  }, [navRef, rowRef, n, enabled])
}

export default function GlassNav({ tabs, currentIdx, bellCount, onTab, onCreate }) {
  const mid = Math.ceil(tabs.length / 2)
  const slots = [...tabs.slice(0, mid), CREATE_SLOT, ...tabs.slice(mid)]
  const n = slots.length

  /* currentIdx is -1 on a sub-page (/messages/:id) — there the chip fades out
     rather than lying about which room you're in. */
  const activeSlot = currentIdx < 0 ? null : (currentIdx < mid ? currentIdx : currentIdx + 1)

  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const retracted = useRetractOnScroll(armed)

  /* The slot under the finger right now. While it is set it OVERRIDES the
     route for everything visual — that is what makes the drag a preview
     instead of a commit. */
  const [scrub, setScrub] = useState(null)

  const navRef = useRef(null)
  const rowRef = useRef(null)
  useBarScrub(navRef, rowRef, n, {
    enabled: armed && !retracted,
    onPreview: setScrub,
    onCommit: (i) => {
      const slot = slots[i]
      if (!slot) return
      // routes through the SAME handlers the tap uses — auth gating and
      // destinations are byte-identical whichever way you got here
      if (slot.create) onCreate()
      else onTab(slot)
    },
  })

  /* Where the chip sits: the finger wins while it is down. */
  const chipSlot = scrub ?? activeSlot

  return (
    <div className="glass-nav-dock" style={{
      position:'fixed', left:0, right:0, zIndex:9999,
      bottom: DOCK_BOTTOM,
      display:'flex', justifyContent:'center', padding:'0 16px',
      pointerEvents:'none',
      transformOrigin:'bottom center',
      /* EL VIDRIO QUE SE APAGABA. Esto era `transform: translateY(0) scale(1)`
         SIEMPRE, más `will-change: transform` — o sea el dock quedaba promovido
         a su propia capa de compositor de forma PERMANENTE. En iOS eso hace que
         el backdrop-filter del hijo muestree sólo dentro de esa capa en vez de
         la página: pinta bien una vez y luego queda plano.
         En reposo ahora es `none`, así que no hay capa, no hay containing block
         y el vidrio muestrea la página de verdad. El transform y el will-change
         sólo existen mientras la barra se está replegando, que es cuando
         realmente hacen falta y cuando la barra se va de todos modos. */
      transform: retracted ? 'translateY(calc(100% + 36px)) scale(0.88)' : 'none',
      opacity: retracted ? 0 : 1,
      transition: armed
        ? `transform ${RETRACT_MS}ms ${HOUSE_EASE}, opacity ${Math.round(RETRACT_MS * 0.7)}ms ${HOUSE_EASE}`
        : 'none',
      willChange: retracted ? 'transform' : 'auto',
    }}>
      {/* zIndex STAYS 9999: every overlay that must cover the bar sits at
          10000 (AuthModal, WorldBuilder, the OS sheet) or above, and
          AuthModal is NOT portaled — it renders earlier in Layout's tree, so
          at an equal z-index the bar would paint OVER the sign-in modal. */}
      <nav className="glass-nav" ref={navRef} aria-hidden={retracted || undefined} style={{
        pointerEvents: retracted ? 'none' : 'auto',
        position:'relative', width:'100%', maxWidth:'344px',
        borderRadius:'34px', padding:'10px 8px 12px', overflow:'visible',
        background:'linear-gradient(180deg, rgba(30,31,40,0.42) 0%, rgba(12,12,17,0.56) 100%)',
        WebkitBackdropFilter: GLASS,
        backdropFilter: GLASS,
        /* the lit top facet over a dark inner floor — this pair, not the
           blur radius, is what the eye reads as thickness */
        border:'1px solid rgba(242,238,230,0.12)',
        boxShadow:[
          '0 26px 54px rgba(0,0,0,0.60)',
          '0 8px 20px rgba(0,0,0,0.45)',
          'inset 0 1.5px 0 rgba(242,238,230,0.22)',
          'inset 0 -1px 0 rgba(7,8,14,0.55)',
          'inset 0 26px 36px -26px rgba(242,238,230,0.22)',
        ].join(', '),
      }}>
        {/* inner top sheen — pure gradient. A backdrop-filter here would make
            it a backdrop root over its own parent and sever the blur. */}
        <div aria-hidden="true" style={{
          position:'absolute', inset:'1px 1px auto 1px', height:'52%',
          borderRadius:'33px 33px 40px 40px', pointerEvents:'none',
          background:'linear-gradient(180deg, rgba(242,238,230,0.13) 0%, rgba(242,238,230,0.04) 40%, transparent 100%)',
        }} />
        <div aria-hidden="true" style={{
          position:'absolute', top:0, left:'12%', right:'12%', height:'1px', pointerEvents:'none',
          background:'linear-gradient(90deg, transparent, rgba(242,238,230,0.78), transparent)',
        }} />

        <div ref={rowRef} style={{ position:'relative', display:'flex', alignItems:'stretch' }}>
          {/* THE CHIP — a pane of brighter glass, not a second blur. It tracks
              the finger during a scrub (fast) and the route otherwise. */}
          <div aria-hidden="true" className="glass-nav-chip" style={{
            position:'absolute', top:0, bottom:0, left:0,
            /* zIndex 0 against the slots' zIndex 1 is LOAD-BEARING: an
               absolutely-positioned element paints above in-flow siblings
               regardless of DOM order, so without this the chip's gradient
               washes over the very icon and label it sits behind. */
            zIndex:0,
            width:`${100 / n}%`, borderRadius:'20px', pointerEvents:'none',
            transform:`translateZ(0) translateX(${(chipSlot ?? 0) * 100}%) scale(${scrub !== null ? 1.04 : 1})`,
            opacity: chipSlot === null ? 0 : 1,
            ...CHIP,
            transition: armed
              ? `transform ${scrub !== null ? SCRUB_MS : CHIP_MS}ms ${scrub !== null ? HOUSE_EASE : CHIP_EASE}, opacity ${CHIP_MS}ms ${CHIP_EASE}`
              : 'none',
            willChange:'transform',
          }} />

          {slots.map((slot, i) => {
            const held = scrub === i
            /* the magnification: the held slot swells and lifts, everything
               else settles back. One transform, compositor-friendly. */
            const lift = {
              transform: held ? 'translateY(-5px) scale(1.22)' : 'translateY(0) scale(1)',
              transition: `transform ${SCRUB_MS}ms ${HOUSE_EASE}`,
            }

            if (slot.create) {
              return (
                <button key="create" type="button" className="pressable glass-tap glass-nav-slot" onClick={onCreate} aria-label="Create"
                  style={{ flex:1, minWidth:0, background:'transparent', border:'none', font:'inherit', cursor:'pointer',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:'5px', padding:'4px 2px',
                    WebkitTapHighlightColor:'transparent', color: BONE,
                    position:'relative', zIndex:1 }}>
                  <span aria-hidden="true" className="glass-chip" style={{
                    width:`${SLOT_BOX}px`, height:`${SLOT_BOX}px`, borderRadius: MARK_CHIP_RADIUS,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    ...BUBBLE, ...lift,
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
                 onClick stays for mouse and keyboard; on touch the scrub
                 commits first and swallows the click that follows. */
              <button key={slot.to} type="button" className="pressable glass-tap glass-nav-slot" onClick={() => onTab(slot)}
                aria-current={active ? 'page' : undefined}
                style={{ flex:1, minWidth:0, cursor:'pointer', display:'flex', flexDirection:'column',
                  alignItems:'center', gap:'5px', padding:'4px 2px',
                  background:'transparent', border:'none', font:'inherit',
                  WebkitTapHighlightColor:'transparent', position:'relative', zIndex:1,
                  /* v12: la opacidad ya no baja a .42. Con el vidrio puesto,
                     atenuar la ranura entera atenuaba también su círculo — y
                     un vidrio al 42% vuelve a leerse como dibujo. Quien manda
                     ahora es el CHIP que viaja; la marca apagada lo dice con
                     color, no borrándose. */
                  color: BONE, opacity: 1 }}>
                <span className="glass-chip" style={{ position:'relative', display:'flex', alignItems:'center',
                  justifyContent:'center', width:`${SLOT_BOX}px`, height:`${SLOT_BOX}px`,
                  borderRadius: MARK_CHIP_RADIUS, ...WELL, ...lift }}>
                  <Mark type={slot.mark} size={ICON} filled={active} color={(active || held) ? BONE : DIM} />
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
