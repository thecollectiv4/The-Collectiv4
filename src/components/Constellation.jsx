import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/* =========================================================================
   Constellation — the universe layer, live in the product.
   A fixed full-viewport <canvas> behind the page: seeded stars, faint
   links between neighbors, slow drift, soft scroll parallax. The same
   star-chart language as the deck — atmosphere, never noise.

   Contract with the page that mounts it:
   • portaled to <body> (a page-transition transform must never become the
     containing block of a fixed layer — the v1 walkthrough lesson), zIndex 0.
   • the page ROOT must set `position:relative; zIndex:1; background:transparent`
     — the portal paints after #root in DOM order, so the page lifts itself
     one layer above the sky, and the sky shows through where the page is void.
     The canvas paints the void gradient itself, so nothing ever flashes.
   • deterministic per `seed` — a person's world keeps its own sky.

   Performance budget (the 10x must not make mobile crawl):
   • star count scales with viewport area (≈26 phone / ≈70 desktop), capped.
   • one rAF loop throttled to ~30fps; paused when the tab is hidden.
   • prefers-reduced-motion → a single static frame, no loop, no parallax.
   ========================================================================= */

function hash(seed = '') { let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0; return h }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

/* `quiet` — the constitutional register (Ley 8: constelación = acento
   quirúrgico, no wallpaper; Ley 1: la decoración sirve). Fewer, fainter
   stars and links: atmosphere you feel, never a layer you read. */
export default function Constellation({ seed = 'c4', quiet = false }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const K = quiet ? 0.62 : 1                 // density multiplier
    const A = quiet ? 0.66 : 1                 // opacity multiplier

    let stars = []
    let links = []
    let raf = 0
    let last = 0
    let scrollY = window.scrollY
    let bgCanvas = null      // void + glow rasterized ONCE per size — a blit per
    let resizeT = 0          // frame beats megapixels of gradient math (review catch)

    const build = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const rnd = mulberry32(hash(String(seed)) + 77)
      const count = Math.round(Math.max(24, Math.min(84, Math.round((w * h) / 24000))) * K)
      // 12% vertical overscan so parallax never exposes a starless band
      stars = Array.from({ length: count }, () => ({
        x: rnd() * w,
        y: rnd() * h * 1.12,
        r: 0.4 + rnd() * 1.1,
        base: (0.1 + rnd() * 0.5) * A,
        depth: 0.35 + rnd() * 0.65,          // parallax layer
        phase: rnd() * Math.PI * 2,
        speed: 0.15 + rnd() * 0.35,          // twinkle
        dx: (rnd() - 0.5) * 0.9,             // px/s drift
        dy: (rnd() - 0.5) * 0.9,
      }))
      // faint links between close neighbors — the chart, not a net
      links = []
      const maxLinks = quiet ? 18 : 34
      const maxD = Math.min(190, w * 0.16)
      for (let i = 0; i < stars.length && links.length < maxLinks; i++) {
        for (let j = i + 1; j < stars.length && links.length < maxLinks; j++) {
          const a = stars[i], b = stars[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < maxD && Math.abs(a.depth - b.depth) < 0.25) links.push([i, j, 1 - d / maxD])
        }
      }
    }

    const buildBg = (w, h) => {
      // the void itself — same gradient family as the page backgrounds.
      // Rasterized ONCE into an offscreen canvas; per-frame it's a single
      // drawImage blit instead of megapixels of gradient math.
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
      glow.addColorStop(0, 'rgba(199,201,209,0.055)')
      glow.addColorStop(1, 'rgba(199,201,209,0)')
      b.fillStyle = glow
      b.fillRect(0, 0, w, h)
    }

    const draw = (t) => {
      const w = window.innerWidth
      const h = window.innerHeight
      if (!bgCanvas) buildBg(w, h)
      ctx.drawImage(bgCanvas, 0, 0, w, h)

      const par = reduced ? 0 : scrollY * 0.06
      const yOf = (s) => {
        const range = h * 1.12
        let y = s.y - par * s.depth
        y = ((y % range) + range) % range   // wrap — the sky never runs out
        return y - h * 0.06
      }

      ctx.lineWidth = 0.6
      for (const [i, j, k] of links) {
        const a = stars[i], b = stars[j]
        ctx.strokeStyle = `rgba(199,201,209,${((0.028 + 0.05 * k) * A).toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(a.x, yOf(a))
        ctx.lineTo(b.x, yOf(b))
        ctx.stroke()
      }
      for (const s of stars) {
        const tw = reduced ? 1 : 0.72 + 0.28 * Math.sin(t * 0.001 * s.speed + s.phase)
        ctx.fillStyle = `rgba(232,233,237,${(s.base * tw).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(s.x, yOf(s), s.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = (t) => {
      raf = requestAnimationFrame(loop)
      if (t - last < 33) return            // ~30fps is plenty for a sky
      last = t
      if (!reduced) {
        const dt = 0.033
        const w = window.innerWidth, range = window.innerHeight * 1.12
        for (const s of stars) {
          s.x += s.dx * dt; s.y += s.dy * dt
          if (s.x < -4) s.x = w + 4; else if (s.x > w + 4) s.x = -4
          if (s.y < -4) s.y = range; else if (s.y > range + 4) s.y = 0
        }
      }
      draw(t)
    }

    const onScroll = () => { scrollY = window.scrollY }
    // debounced: mobile URL-bar show/hide fires resize storms — one rebuild
    // after the dust settles, not a canvas realloc per event
    const onResize = () => {
      clearTimeout(resizeT)
      resizeT = setTimeout(() => { bgCanvas = null; build(); draw(last) }, 160)
    }
    const onVis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop)
    }

    build()
    draw(0)
    if (!reduced) raf = requestAnimationFrame(loop)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resizeT)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [seed, quiet])

  return createPortal(
    <canvas ref={ref} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />,
    document.body
  )
}
