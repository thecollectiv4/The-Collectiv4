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
   pointer entirely: grain, a few far stars, drift you can barely see.

   v12 adds `sky`: the STATIC depth multiplier (nebula + river + dust).
   It rides the rasterized layer, so it scales the sky's BEAUTY without
   touching the per-frame cost — quiet surfaces get a dimmer deep field,
   not a cheaper one. */
const PRESETS = {
  dense:  { k: 1,    linkA: 0.14, mouse: true,  starsO: [0.5, 0.35], sky: 1 },
  medium: { k: 0.62, linkA: 0.09, mouse: true,  starsO: [0.3, 0.2],  sky: 0.72 },
  quiet:  { k: 0,    linkA: 0,    mouse: false, starsO: [0.14, 0.1], sky: 0.4, fixedCount: 5 },
}

/* =========================================================================
   V12 — EL RÍO DE ESTRELLAS. The sky stops being "void + dots" and becomes
   deep space: nebula, a current of light, and real star dust.

   THE LAW THIS OBEYS (Ley 8 + La Ley del Lujo Inmersivo): the constellation
   is a surgical accent, NEVER wallpaper. So "más cabrón" is bought with
   DEPTH, not density — more layers, lower opacity, better placement. Every
   value below is deliberately under the threshold where it competes with
   the content. A sky that screams is a screensaver.

   THE PERFORMANCE THESIS: depth is STATIC, motion is SPARSE. The nebula,
   the river and the ~420 dust stars are painted ONCE into the cached
   background raster and blitted as a single bitmap per frame — they cost
   nothing to animate because they don't. Only the 14–40 constellation
   nodes move. The sky gets richer; the iPhone's frame budget does not.

   THE PALETTE IS TEMPERATURE, NOT COLOR: Cosmos forbids color gradients,
   so the "aurora dorada-azul" of the brief lands at 2–4% alpha, where it
   reads as depth and warmth-of-distance, never as a hue. Desaturated on
   purpose — museum, not circus.
   ========================================================================= */

// nebula tints — cold silver-blue with ONE restrained gold, the aurora of
// the brief held at a whisper. Never saturated: these are near-greys that
// merely lean. [r,g,b, peak alpha]
const NEBULA = [
  [122, 146, 190, 0.088],   // cold blue — the deep field
  [186, 198, 222, 0.058],   // silver — the diffuse middle
  [198, 170, 118, 0.048],   // gold — the aurora, the single warm note
  [96, 118, 158, 0.068],    // far blue — the depth behind everything
]

/* route → surface register. Overrides (a world's own sky) win over this. */
function presetForPath(path) {
  if (path === '/c4' || path.startsWith('/e/')) return { density: 'dense', tint: '242,238,230', seed: 'c4-stage' }
  if (path === '/') return { density: 'medium', tint: '242,238,230', seed: 'the-rooms' }
  if (path.startsWith('/community')) return { density: 'medium', tint: '199,201,209', seed: 'the-creative-universe' }
  if (path.startsWith('/user/') || path.startsWith('/profile')) return { density: 'medium', tint: '199,201,209', seed: 'a-world' }
  if (path.startsWith('/experience') || path.startsWith('/editions')) return { density: 'medium', tint: '242,238,230', seed: 'the-archive' }
  if (path.startsWith('/messages')) return { density: 'quiet', tint: '232,233,237', seed: 'the-conversations' }
  if (path.startsWith('/os')) return { density: 'quiet', tint: '232,233,237', seed: 'the-instrument' }
  /* v12 — the rooms that never had a sky. /auth and /claim are ceremony:
     the door you're being let through, and the night you just bought. They
     get a live register. The legal pages are paperwork — grain and a far
     star, nothing that competes with a wall of text. */
  if (path.startsWith('/auth') || path.startsWith('/__gate')) return { density: 'medium', tint: '199,201,209', seed: 'la-puerta' }
  if (path.startsWith('/claim')) return { density: 'medium', tint: '242,238,230', seed: 'your-first-night' }
  if (path.startsWith('/reset-password')) return { density: 'quiet', tint: '199,201,209', seed: 'the-way-back' }
  if (path.startsWith('/terms') || path.startsWith('/privacy') || path.startsWith('/refunds')) return { density: 'quiet', tint: '199,201,209', seed: 'the-paperwork' }
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
  // survives cfg changes: bg raster cache (size|tint → offscreen canvas) and
  // the first-mount flag that decides fade-in vs full crossfade (review catch)
  const bgCache = useRef(new Map())
  const firstMount = useRef(true)

  /* the constellation — deck engine + the hardening the product earned */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return   // decoration never takes the page down
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(pointer: fine)').matches
    // ~60fps where a mouse looks back (15ms also tames 120Hz ProMotion —
    // frameMs=0 let draw() run at display rate, review HIGH), ~30 on touch,
    // and the QUIET register idles at ~15fps: five bare stars drifting
    // 0.16px/frame need nothing more (review catch)
    const frameMs = preset.fixedCount ? 66 : (finePointer ? 15 : 31)

    let nodes = []
    let raf = 0
    let last = 0
    let bgCanvas = null
    let resizeT = 0
    let mx = -9999, my = -9999
    let fadeT = 0
    let clock = 0   // v12: seconds-ish, advanced by the loop — drives twinkle
    // v12: the bloom, baked once. Alpha rides on globalAlpha at draw time, so
    // one white sprite serves every brightness and every twinkle phase.
    let haloSprite = null
    const buildHalo = () => {
      const S = 64
      const cv = document.createElement('canvas')
      cv.width = S; cv.height = S
      const g2 = cv.getContext('2d')
      if (!g2) return null
      const g = g2.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
      g.addColorStop(0, 'rgba(232,236,246,1)')
      g.addColorStop(1, 'rgba(232,236,246,0)')
      g2.fillStyle = g
      g2.fillRect(0, 0, S, S)
      return cv
    }
    let holdBuild = false   // true while the OLD sky fades out — the loop
                            // must neither rebuild nor repaint over it

    const build = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      if (w < 1 || h < 1) { nodes = []; return }
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      // realloc the backing store ONLY when the size actually changed — a
      // seed/tint change must not repay a multi-MB canvas alloc (review catch)
      const bw = Math.round(w * dpr), bh = Math.round(h * dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!haloSprite) haloSprite = buildHalo()
      const rnd = mulberry32(hash(cfg.seed) + 77)
      // the deck's own count: min(40, max(14, w/34)) — scaled by register.
      // quiet surfaces hold a fixed handful: a far star, not a chart.
      const n = preset.fixedCount ?? Math.round(Math.min(40, Math.max(14, Math.floor(w / 34))) * preset.k)
      // v12 — the node count is UNCHANGED (the frame budget v10 tuned stays
      // exactly where it was). What changes is that each node now has a
      // MAGNITUDE and a twinkle phase, so the foreground reads as a star
      // field with depth instead of 40 identical dots. Plus a shared current:
      // the drift is no longer pure noise, it flows, so the sky breathes in
      // one direction the way weather does.
      const cur = (rnd() - 0.5) * 0.06                      // the current's bias
      const curY = (rnd() - 0.5) * 0.04
      nodes = Array.from({ length: n }, () => {
        const m = rnd()                                     // magnitude roll
        const bright = m > 0.92                             // ~3 per sky
        const mid = !bright && m > 0.62
        return {
          x: rnd() * w,
          y: rnd() * h,
          vx: (rnd() - 0.5) * 0.16 + cur,   // deck drift: px/frame @60 — barely there
          vy: (rnd() - 0.5) * 0.16 + curY,
          r: bright ? 1.5 + rnd() * 0.6 : mid ? 0.9 + rnd() * 0.5 : 0.5 + rnd() * 0.35,
          a: bright ? 0.92 : mid ? 0.66 : 0.42,             // was a flat 0.7 for all
          halo: bright,                                     // only the brightest earn one
          ph: rnd() * 6.28,                                 // twinkle phase
          tw: 0.6 + rnd() * 0.9,                            // twinkle speed
        }
      })
    }

    const buildBg = (w, h) => {
      // void + temperature, rasterized ONCE — a blit per frame, not
      // megapixels of gradient math. 0-sized viewports must not build
      // (drawImage throws on a 0-sized source — the v4 pane catch).
      // Cached per size|tint across cfg changes: returning to a room with
      // the same temperature never repays the raster (review catch).
      if (w < 1 || h < 1) { bgCanvas = null; return }
      // v12: seed + sky join the cache key — two worlds at the same size no
      // longer share one bitmap now that the deep field is per-seed.
      const key = `${w}x${h}|${TINT}|${cfg.seed}|${preset.sky}`
      // LRU, not FIFO. v12 added the SEED to this key, and seeds are per-entity
      // (a profile id, an event slug), so the number of distinct keys is now
      // unbounded where it used to be a handful of tints. Under plain FIFO a
      // re-read never refreshed position, so the hot home sky was evicted by
      // one-shot profile skies. Touch on hit = the skies you actually revisit
      // are the ones that survive.
      const hit = bgCache.current.get(key)
      if (hit) {
        bgCache.current.delete(key); bgCache.current.set(key, hit)
        bgCanvas = hit; return
      }
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

      /* ---- v12 deep field: everything below is painted ONCE, right here ----
         Same random stream as the nodes (seeded), so a world's nebula, its
         river and its stars are one composition rather than three accidents. */
      const sky = preset.sky ?? 1
      const srnd = mulberry32(hash(cfg.seed) + 913)
      const diag = Math.hypot(w, h)

      // 1. THE NEBULA — four soft clouds, screen-blended so they add light
      // instead of muddying the void. Placement is seeded but biased to the
      // upper field and the corners: clouds behind the content, never a
      // bloom under the middle of the page where text lives (Ley 3).
      b.globalCompositeOperation = 'screen'
      for (let i = 0; i < NEBULA.length; i++) {
        const [r, gg, bb, a] = NEBULA[i]
        const cx = w * (0.12 + srnd() * 0.78)
        // keep the mass out of the reading band: top third or bottom sixth
        const cy = srnd() < 0.7 ? h * (0.02 + srnd() * 0.32) : h * (0.82 + srnd() * 0.2)
        const rad = diag * (0.34 + srnd() * 0.36)
        const cloud = b.createRadialGradient(cx, cy, 0, cx, cy, rad)
        const peak = a * sky
        cloud.addColorStop(0, `rgba(${r},${gg},${bb},${peak})`)
        cloud.addColorStop(0.42, `rgba(${r},${gg},${bb},${peak * 0.38})`)
        cloud.addColorStop(1, `rgba(${r},${gg},${bb},0)`)
        b.fillStyle = cloud
        b.fillRect(0, 0, w, h)
      }

      // 2. THE RIVER — the current of light the brief asked for. A soft band
      // raked across the field at a seeded angle: the Milky Way read as a
      // gesture, not a stripe. Drawn as a long, very low-alpha capsule so it
      // has a bright spine and no edges.
      const ang = (-0.62 + srnd() * 0.34)              // roughly lower-left → upper-right
      const rcx = w * (0.3 + srnd() * 0.4)
      const rcy = h * (0.34 + srnd() * 0.36)
      b.save()
      b.translate(rcx, rcy)
      b.rotate(ang)
      const band = b.createLinearGradient(0, -diag * 0.16, 0, diag * 0.16)
      band.addColorStop(0, 'rgba(150,172,208,0)')
      band.addColorStop(0.42, `rgba(150,172,208,${0.044 * sky})`)
      band.addColorStop(0.5, `rgba(214,222,238,${0.070 * sky})`)   // the spine
      band.addColorStop(0.58, `rgba(150,172,208,${0.044 * sky})`)
      band.addColorStop(1, 'rgba(150,172,208,0)')
      b.fillStyle = band
      b.fillRect(-diag, -diag * 0.16, diag * 2, diag * 0.32)
      b.restore()

      // 3. THE DUST — the depth that makes it read as SPACE and not as a
      // gradient. ~420 sub-pixel stars, denser along the river (that is what
      // a galactic band IS), all static. This is the single biggest visual
      // win in the file and it costs exactly one bitmap.
      const dustN = Math.round(Math.min(520, Math.max(160, (w * h) / 2600)) * sky)
      const sinA = Math.sin(ang), cosA = Math.cos(ang)
      for (let i = 0; i < dustN; i++) {
        let x = srnd() * w
        let y = srnd() * h
        // 55% of the dust is pulled toward the river's spine — the band gets
        // its density from stars, the way a real one does.
        if (srnd() < 0.55) {
          const along = (srnd() - 0.5) * diag * 1.6
          const across = (srnd() + srnd() + srnd() - 1.5) * diag * 0.075   // ~gaussian
          x = rcx + along * cosA - across * sinA
          y = rcy + along * sinA + across * cosA
          if (x < 0 || x > w || y < 0 || y > h) continue
        }
        const m = srnd()                       // magnitude roll
        const rr = m > 0.985 ? 1.25 : m > 0.9 ? 0.85 : 0.55
        const aa = (m > 0.985 ? 0.62 : m > 0.9 ? 0.4 : 0.22) * sky
        b.globalAlpha = aa
        b.fillStyle = m > 0.96 ? '#DCE4F2' : BONE   // the brightest lean blue-white
        b.beginPath(); b.arc(x, y, rr, 0, 6.3); b.fill()
      }
      b.globalAlpha = 1
      b.globalCompositeOperation = 'source-over'

      // Cap of 4, down from 8. Each entry is a full-viewport canvas at DPR 2 —
      // ~5–6 MB on a large phone. With per-entity seeds the cache now actually
      // reaches its cap (it never did when the key was just size|tint), so 8
      // meant ~50 MB of backing store on the device that can least afford it,
      // on a surface that also runs Stripe checkout. 4 is ~20 MB and still
      // holds every sky in a normal back-and-forth.
      if (bgCache.current.size > 4) bgCache.current.delete(bgCache.current.keys().next().value)
      bgCache.current.set(key, bgCanvas)
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
        // v12 — magnitude + twinkle. Under reduced-motion the star holds its
        // base alpha: the twinkle is motion and motion is off, full stop.
        const tw = reduced ? 1 : 0.78 + 0.22 * Math.sin(clock * p.tw + p.ph)
        if (p.halo && haloSprite) {
          // the brightest few get a soft bloom — this is what sells "star"
          // over "dot". The gradient is baked ONCE into a 64px sprite at
          // build time and blitted here: createRadialGradient in the draw
          // loop would allocate a gradient object per bright star per frame
          // (~90/sec on a phone) purely to throw it away. Same picture, no
          // per-frame garbage.
          const hr = p.r * 5
          ctx.globalAlpha = 0.20 * tw
          ctx.drawImage(haloSprite, p.x - hr, p.y - hr, hr * 2, hr * 2)
        }
        ctx.globalAlpha = p.a * tw
        ctx.fillStyle = p.halo ? '#EDF1FA' : BONE
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const loop = (t) => {
      raf = requestAnimationFrame(loop)
      if (holdBuild) return   // the old sky is mid-fade — leave its bitmap be
      if (t - last < frameMs) return
      // born at 0 size (prerender) and now real — build when the viewport exists
      if (!nodes.length && window.innerWidth > 0 && window.innerHeight > 0) build()
      const dtFrames = last ? Math.min(3, (t - last) / 16.67) : 1
      last = t
      clock += dtFrames * 0.0167   // frames → seconds, clamped by dtFrames
      draw(dtFrames)
    }

    const onMouse = (e) => { mx = e.clientX; my = e.clientY }
    const onLeave = () => { mx = -9999; my = -9999 }
    const onResize = () => {
      // debounced — mobile URL-bar show/hide fires resize storms. New size →
      // new cache key; bgCanvas just re-resolves through the cache.
      clearTimeout(resizeT)
      resizeT = setTimeout(() => { bgCanvas = null; build(); draw(0) }, 160)
    }
    const onVis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduced) { last = 0; raf = requestAnimationFrame(loop) }
    }

    // room-to-room: the sky settles rather than snapping (Ley 13). First
    // mount fades straight in; a RE-configuration fades the old sky OUT,
    // rebuilds behind the dark, then fades the new one in — stars never
    // teleport mid-view (review catch: the old 30ms swap repainted first).
    if (firstMount.current) {
      firstMount.current = false
      canvas.style.transition = 'opacity .6s ease'
      canvas.style.opacity = '0'
      build()
      draw(0)
      fadeT = setTimeout(() => { canvas.style.opacity = '1' }, 30)
    } else {
      holdBuild = true
      canvas.style.transition = 'opacity .22s ease'
      canvas.style.opacity = '0'
      fadeT = setTimeout(() => {
        holdBuild = false
        build()
        draw(0)
        canvas.style.transition = 'opacity .5s ease'
        canvas.style.opacity = '1'
      }, 240)
    }

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
     Desktop pointers only; rAF-throttled; dead under reduced-motion — and
     dead on QUIET surfaces: where you read, even the tiles hold still
     (review catch: the register promised zero pointer reaction). */
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || !preset.mouse || !window.matchMedia('(pointer: fine)').matches) return undefined
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
  }, [preset.mouse])

  // -28px covers the ±12px max parallax travel with margin (the tiles repeat,
  // no empty band can show); -40% rasterized 3.24x the viewport per layer for
  // nothing (review catch). willChange: these layers animate for the app's
  // whole life — the one legitimate use.
  const layer = { position: 'fixed', inset: '-28px', pointerEvents: 'none', backgroundRepeat: 'repeat', transition: 'opacity .8s ease', willChange: 'transform' }

  return (
    <div ref={wrapRef} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {/* the constellation — void gradient + temperature painted by the canvas;
          opacity/transition are driven imperatively (mount fade / crossfade) */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
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
