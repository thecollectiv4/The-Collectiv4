import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

/* =========================================================================
   ATMOSPHERE — the founder's own galaxy, crossed into the product (v8).

   The recipe is collectiv4-universe.html — tuned, proven, NOT reinvented:
   film grain (feTurbulence .85 / 2 oct / 5%), a double CSS starfield with
   two parallax speeds (13 / 24 — depth is born from the two velocities),
   and a canvas constellation whose nodes drift at .16px/frame and draw
   their own links (d<120 → alpha (1-d/120)*.14). The links ARE the thesis:
   we draw the lines between the stars.

   ONE living layer for the whole app — mounted once in Layout, behind
   every route. Never per-page canvases again (the v1..v7 model): the sky
   persists across navigation, so moving between rooms never blinks.

   THE ANTI-CORNY LAW: a galaxy that screams is a screensaver; a galaxy
   that breathes is a room. Density is per-surface (D2):
     dense  — /c4 + event heroes: the stage, sky alive
     medium — community / the rooms directory / a person's world
     quiet  — messages, /os, the work surfaces: grain and a far star.
   Where you read, the galaxy shuts up.

   Performance is a requirement, not a footnote:
   • one shared canvas, DPR ≤ 2, background rasterized once and blitted
   • rAF paused when the tab hides; 60fps only where a pointer exists,
     30fps on touch (no mouse → nothing to react to at 60)
   • prefers-reduced-motion: ALL motion off — static grain + static tiles,
     constellation canvas paints only the void gradient. Non-negotiable.
   ========================================================================= */

const BONE = '#F2EEE6'

/* ---- deck grain: feTurbulence 0.85, 2 octaves, 5%, fixed over all ---- */
const NOISE = "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
const GRAIN_URI = `url("data:image/svg+xml,${encodeURIComponent(NOISE)}")`

/* ---- deck starfield tiles (560px @ .5 / 360px @ .35, scaled per surface) ---- */
const STARS_1 = [
  'radial-gradient(1px 1px at 18% 28%, rgba(242,238,230,.95), transparent)',
  'radial-gradient(1px 1px at 82% 18%, rgba(242,238,230,.7), transparent)',
  'radial-gradient(1.3px 1.3px at 64% 68%, rgba(242,238,230,.85), transparent)',
  'radial-gradient(1px 1px at 34% 82%, rgba(242,238,230,.7), transparent)',
  'radial-gradient(1px 1px at 50% 48%, rgba(242,238,230,.8), transparent)',
  'radial-gradient(1px 1px at 11% 62%, rgba(242,238,230,.6), transparent)',
  'radial-gradient(1px 1px at 90% 46%, rgba(242,238,230,.6), transparent)',
].join(',')
const STARS_2 = [
  'radial-gradient(1px 1px at 22% 44%, rgba(242,238,230,.55), transparent)',
  'radial-gradient(1px 1px at 72% 34%, rgba(242,238,230,.5), transparent)',
  'radial-gradient(1px 1px at 46% 84%, rgba(242,238,230,.5), transparent)',
  'radial-gradient(1px 1px at 88% 76%, rgba(242,238,230,.45), transparent)',
].join(',')

/* ---- density registers (D2) — the deck numbers, then restraint ----
   k scales the deck's node formula; linkA is the deck's link ceiling;
   starsO scales the two CSS tile layers. quiet kills links and the
   pointer entirely: grain, a few far stars, drift you can barely see. */
const PRESETS = {
  dense:  { k: 1,    linkA: 0.14, mouse: true,  starsO: [0.5, 0.35] },
  medium: { k: 0.62, linkA: 0.09, mouse: true,  starsO: [0.3, 0.2] },
  quiet:  { k: 0,    linkA: 0,    mouse: false, starsO: [0.14, 0.1], fixedCount: 5 },
}

/* route → surface register. Overrides (a world's own sky) win over this. */
function presetForPath(path) {
  if (path === '/c4' || path.startsWith('/e/')) return { density: 'dense', tint: '242,238,230', seed: 'c4-stage' }
  if (path === '/') return { density: 'medium', tint: '242,238,230', seed: 'the-rooms' }
  if (path.startsWith('/community')) return { density: 'medium', tint: '199,201,209', seed: 'the-creative-universe' }
  if (path.startsWith('/user/') || path.startsWith('/profile')) return { density: 'medium', tint: '199,201,209', seed: 'a-world' }
  if (path.startsWith('/experience') || path.startsWith('/editions')) return { density: 'medium', tint: '242,238,230', seed: 'the-archive' }
  if (path.startsWith('/messages')) return { density: 'quiet', tint: '232,233,237', seed: 'the-conversations' }
  if (path.startsWith('/os')) return { density: 'quiet', tint: '232,233,237', seed: 'the-instrument' }
  return { density: 'quiet', tint: '199,201,209', seed: 'c4' }
}

/* deterministic sky per seed — a person's world keeps its own stars */
function hash(seed = '') { let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0; return h }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

/* ---------------- context: pages can claim the sky ---------------- */
const CosmosContext = createContext({ setOverride: () => {} })

export function CosmosProvider({ children }) {
  const [override, setOverride] = useState(null)
  const value = useMemo(() => ({ override, setOverride }), [override])
  return <CosmosContext.Provider value={value}>{children}</CosmosContext.Provider>
}

/* a page claims its own sky (seed / tint / density) while mounted —
   the museum tints the sky with its primary craft's temperature (D2),
   an event hero carries its declared vibe. Cleared on unmount. */
export function useCosmosOverride(seed, tint, density) {
  const { setOverride } = useContext(CosmosContext)
  useEffect(() => {
    if (!seed && !tint && !density) return undefined
    setOverride({ seed, tint, density })
    return () => setOverride(null)
  }, [seed, tint, density, setOverride])
}

/* ---------------- the sky itself ---------------- */
export default function Atmosphere() {
  const location = useLocation()
  const { override } = useContext(CosmosContext)
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const s1Ref = useRef(null)
  const s2Ref = useRef(null)

  const routeCfg = presetForPath(location.pathname)
  const cfg = {
    density: override?.density || routeCfg.density,
    tint: override?.tint || routeCfg.tint,
    seed: override?.seed || routeCfg.seed,
  }
  const preset = PRESETS[cfg.density] || PRESETS.quiet
  const TINT = /^\d{1,3},\d{1,3},\d{1,3}$/.test(cfg.tint) ? cfg.tint : '199,201,209'
  const cfgKey = `${cfg.density}|${TINT}|${cfg.seed}`

  /* the constellation — deck engine + the hardening the product earned */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return   // decoration never takes the page down
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(pointer: fine)').matches
    const frameMs = finePointer ? 0 : 31   // 60fps where a mouse looks back, ~30 on touch

    let nodes = []
    let raf = 0
    let last = 0
    let bgCanvas = null
    let resizeT = 0
    let mx = -9999, my = -9999
    let fadeT = 0

    const build = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      if (w < 1 || h < 1) { nodes = []; return }
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const rnd = mulberry32(hash(cfg.seed) + 77)
      // the deck's own count: min(40, max(14, w/34)) — scaled by register.
      // quiet surfaces hold a fixed handful: a far star, not a chart.
      const n = preset.fixedCount ?? Math.round(Math.min(40, Math.max(14, Math.floor(w / 34))) * preset.k)
      nodes = Array.from({ length: n }, () => ({
        x: rnd() * w,
        y: rnd() * h,
        vx: (rnd() - 0.5) * 0.16,          // deck drift: px/frame @60 — barely there
        vy: (rnd() - 0.5) * 0.16,
        r: rnd() * 1.3 + 0.5,              // deck radius: .5–1.8
      }))
    }

    const buildBg = (w, h) => {
      // void + temperature, rasterized ONCE — a blit per frame, not
      // megapixels of gradient math. 0-sized viewports must not build
      // (drawImage throws on a 0-sized source — the v4 pane catch).
      if (w < 1 || h < 1) { bgCanvas = null; return }
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      bgCanvas = document.createElement('canvas')
      bgCanvas.width = Math.round(w * dpr)
      bgCanvas.height = Math.round(h * dpr)
      const b = bgCanvas.getContext('2d')
      b.setTransform(dpr, 0, 0, dpr, 0, 0)
      const g = b.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#0B0B10')
      g.addColorStop(0.55, '#08080D')
      g.addColorStop(1, '#07080E')
      b.fillStyle = g
      b.fillRect(0, 0, w, h)
      const glow = b.createRadialGradient(w * 0.5, h * 0.04, 0, w * 0.5, h * 0.04, Math.max(w, h) * 0.7)
      glow.addColorStop(0, `rgba(${TINT},0.055)`)
      glow.addColorStop(1, `rgba(${TINT},0)`)
      b.fillStyle = glow
      b.fillRect(0, 0, w, h)
    }

    const draw = (dtFrames) => {
      const w = window.innerWidth
      const h = window.innerHeight
      if (!bgCanvas) buildBg(w, h)
      if (!bgCanvas) return
      ctx.drawImage(bgCanvas, 0, 0, w, h)
      const linkA = preset.linkA
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i]
        if (!reduced) {
          p.x += p.vx * dtFrames
          p.y += p.vy * dtFrames
          if (p.x < 0 || p.x > w) p.vx *= -1
          if (p.y < 0 || p.y > h) p.vy *= -1
        }
        if (linkA > 0) {
          for (let j = i + 1; j < nodes.length; j++) {
            const q = nodes[j]
            const dx = p.x - q.x, dy = p.y - q.y
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d < 120) {
              // the deck link law: alpha (1-d/120) × register ceiling
              ctx.globalAlpha = (1 - d / 120) * linkA
              ctx.strokeStyle = `rgb(${TINT})`
              ctx.lineWidth = 0.6
              ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke()
            }
          }
        }
        if (preset.mouse && !reduced) {
          const mdx = p.x - mx, mdy = p.y - my
          const md = Math.sqrt(mdx * mdx + mdy * mdy)
          if (md < 150) {
            // the sky reacts to whoever is looking at it (D4)
            ctx.globalAlpha = (1 - md / 150) * 0.4
            ctx.strokeStyle = BONE
            ctx.lineWidth = 0.7
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mx, my); ctx.stroke()
          }
        }
        ctx.globalAlpha = 0.7
        ctx.fillStyle = BONE
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const loop = (t) => {
      raf = requestAnimationFrame(loop)
      if (t - last < frameMs) return
      // born at 0 size (prerender) and now real — build when the viewport exists
      if (!nodes.length && window.innerWidth > 0 && window.innerHeight > 0) build()
      const dtFrames = last ? Math.min(3, (t - last) / 16.67) : 1
      last = t
      draw(dtFrames)
    }

    const onMouse = (e) => { mx = e.clientX; my = e.clientY }
    const onLeave = () => { mx = -9999; my = -9999 }
    const onResize = () => {
      // debounced — mobile URL-bar show/hide fires resize storms
      clearTimeout(resizeT)
      resizeT = setTimeout(() => { bgCanvas = null; build(); draw(0) }, 160)
    }
    const onVis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduced) { last = 0; raf = requestAnimationFrame(loop) }
    }

    // room-to-room: the sky settles in rather than snapping (Ley 13)
    canvas.style.opacity = '0'
    build()
    draw(0)
    fadeT = setTimeout(() => { canvas.style.opacity = '1' }, 30)

    if (!reduced) raf = requestAnimationFrame(loop)
    if (preset.mouse && finePointer && !reduced) {
      window.addEventListener('mousemove', onMouse, { passive: true })
      document.documentElement.addEventListener('mouseleave', onLeave)
    }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resizeT)
      clearTimeout(fadeT)
      window.removeEventListener('mousemove', onMouse)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [cfgKey]) // eslint-disable-line react-hooks/exhaustive-deps

  /* the double starfield's parallax — two speeds, one gesture (deck: 13/24).
     Desktop pointers only; rAF-throttled; dead under reduced-motion. */
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return undefined
    let raf = 0
    const onMove = (ev) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const x = ev.clientX / window.innerWidth - 0.5
        const y = ev.clientY / window.innerHeight - 0.5
        if (s1Ref.current) s1Ref.current.style.transform = `translate(${x * 13}px,${y * 13}px)`
        if (s2Ref.current) s2Ref.current.style.transform = `translate(${x * 24}px,${y * 24}px)`
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mousemove', onMove) }
  }, [])

  const layer = { position: 'fixed', inset: '-40%', pointerEvents: 'none', backgroundRepeat: 'repeat', transition: 'opacity .8s ease' }

  return (
    <div ref={wrapRef} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {/* the constellation — void gradient + temperature painted by the canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, transition: 'opacity .6s ease' }} />
      {/* two star depths — the deck tiles, scaled by the surface's register */}
      <div ref={s1Ref} style={{ ...layer, backgroundImage: STARS_1, backgroundSize: '560px 560px', opacity: preset.starsO[0] }} />
      <div ref={s2Ref} style={{ ...layer, backgroundImage: STARS_2, backgroundSize: '360px 360px', opacity: preset.starsO[1] }} />
    </div>
  )
}

/* film grain — the archive varnish over EVERYTHING (deck: fixed, 5%,
   above all content including modals). Mounted separately so it can sit
   at the very top of the stack while the sky sits at the very bottom. */
export function Grain() {
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 12000, pointerEvents: 'none', opacity: 0.05, backgroundImage: GRAIN_URI, backgroundSize: '160px 160px' }} />
  )
}
