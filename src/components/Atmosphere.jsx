import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '@/lib/theme'

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

/* ---- deck starfield tiles (560px @ .5 / 360px @ .35, scaled per surface) ----
   Estas DOS capas son CSS, no canvas, así que se llevan la variable de canal
   directo y cambian de registro solas — cero JavaScript, cero rebuild. Es la
   única parte del cielo que no tuvo que aprender de temas: ya sabía. */
const STARS_1 = [
  'radial-gradient(1px 1px at 18% 28%, rgba(var(--ink-rgb),.95), transparent)',
  'radial-gradient(1px 1px at 82% 18%, rgba(var(--ink-rgb),.7), transparent)',
  'radial-gradient(1.3px 1.3px at 64% 68%, rgba(var(--ink-rgb),.85), transparent)',
  'radial-gradient(1px 1px at 34% 82%, rgba(var(--ink-rgb),.7), transparent)',
  'radial-gradient(1px 1px at 50% 48%, rgba(var(--ink-rgb),.8), transparent)',
  'radial-gradient(1px 1px at 11% 62%, rgba(var(--ink-rgb),.6), transparent)',
  'radial-gradient(1px 1px at 90% 46%, rgba(var(--ink-rgb),.6), transparent)',
].join(',')
const STARS_2 = [
  'radial-gradient(1px 1px at 22% 44%, rgba(var(--ink-rgb),.55), transparent)',
  'radial-gradient(1px 1px at 72% 34%, rgba(var(--ink-rgb),.5), transparent)',
  'radial-gradient(1px 1px at 46% 84%, rgba(var(--ink-rgb),.5), transparent)',
  'radial-gradient(1px 1px at 88% 76%, rgba(var(--ink-rgb),.45), transparent)',
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

/* =========================================================================
   V12 — EL CIELO TIENE DOS REGISTROS, Y EL DE DÍA NO ES "EL CIELO ACLARADO".

   La tentación era subirle el brillo al fondo y dejar todo lo demás igual.
   Eso da un cielo lavado: las estrellas claras se pierden contra el papel y
   la nebulosa desaparece, porque en `screen` una nube clara sobre un fondo
   claro no suma nada. Sería exactamente el "tema genérico" que el encargo
   prohíbe.

   LA REFERENCIA REAL — LA PLACA FOTOGRÁFICA. Los archivos astronómicos de
   verdad (Harvard, el Palomar) son NEGATIVOS: estrellas OSCURAS impresas
   sobre papel crema. Un siglo de astronomía se ve así. De día el cielo de
   C4 es esa placa — no una inversión de software, un objeto de museo que ya
   existe. Museo, no circo, literalmente.

   LO QUE ESO CAMBIA, Y POR QUÉ CADA COSA:
   · `screen` → `multiply`. En el vacío la profundidad SUMA luz; en el papel
     la profundidad es TINTA. Es la misma nube, con el signo cambiado.
   · Las estrellas más brillantes son las MÁS OSCURAS. Suena al revés hasta
     que se ve: en un negativo, más luz capturada = más plata revelada.
   · El halo deja de ser resplandor y pasa a ser una mancha suave de tinta —
     el florecimiento del grano alrededor de una estrella sobreexpuesta.
   Las α de día son ~1.5x las de noche: `multiply` sobre un sustrato claro
   rinde menos que `screen` sobre uno oscuro, así que igualar los números
   habría dado un cielo tímido.

   LA TEMPERATURA SOBREVIVE EN LOS DOS. El azul-dorado del encargo son los
   mismos matices en ambos registros: cerca del gris, apenas inclinados,
   entre 4% y 13%. Cosmos prohíbe degradados de color; esto no es color, es
   distancia. Saturarlo sería romper la paleta, y se nota enseguida.
   ========================================================================= */
const SKY = {
  dark: {
    grad: ['#0B0B10', '#08080D', '#07080E'],
    blend: 'screen',
    // [r,g,b, peak alpha] — grises que apenas se inclinan, nunca saturados
    nebula: [
      [122, 146, 190, 0.088],   // cold blue — the deep field
      [186, 198, 222, 0.058],   // silver — the diffuse middle
      [198, 170, 118, 0.048],   // gold — the aurora, the single warm note
      [96, 118, 158, 0.068],    // far blue — the depth behind everything
    ],
    river: { edge: '150,172,208', spine: '214,222,238', aEdge: 0.044, aSpine: 0.070 },
    dust: { base: BONE, bright: '#DCE4F2', aFar: 0.22, aMid: 0.4, aNear: 0.62 },
    micro: '#C9D2E4', aMicro: 0.10,
    node: BONE, nodeHi: '#EDF1FA',
    halo: '232,236,246',
    haloA: 0.20,
    spike: '226,232,244', aSpike: 0.13,
    glow: null,                 // el glow superior usa el TINT de la ruta
  },
  /* ── REVISIÓN DE DIEGO: "muy blanco, no parece galaxy" ──────────────────
     Tenía razón y la causa era medible, no de gusto. Tres cosas la
     aplanaban, en orden de culpa:

     1. EL LAVADO BLANCO AL 0.5. Un resplandor blanco cubriendo el 70% del
        radio superior sobre un fondo que ya era casi blanco: en la práctica
        borraba el recorrido vertical del degradado y dejaba una hoja lisa.
        La luz de día tiene que INSINUARSE (0.14), no inundar.
     2. EL DEGRADADO BASE NO RECORRÍA NADA. #F3F1EC → #E4E2DA son 15 puntos
        de luminancia: sin viaje de arriba a abajo no hay espacio, hay papel.
        Ahora abre a ~34 puntos y el fondo tiene fondo.
     3. LAS α DE `multiply` COPIADAS DE LA INTUICIÓN. Multiplicar sobre un
        sustrato claro rinde MUCHO menos que `screen` sobre uno oscuro; las
        subí ~1.5x en el primer intento y seguía corto. Van ~2.4x sobre el
        original y recién ahí la nebulosa se lee como nebulosa.

     Se suma una VIÑETA que el registro oscuro no necesita: en el vacío los
     bordes ya caen a negro solos, en papel no cae nada y la pantalla lee
     como una hoja pegada. Oscurecer las esquinas es lo que convierte la
     hoja en una bóveda. Es la única capa que existe en un registro y no en
     el otro, y por eso está comentada.
     Todo esto vive en el raster cacheado: cero costo por frame. */
  light: {
    grad: ['#F7F5F1', '#EAE8E1', '#D9D6CD'],
    blend: 'multiply',
    nebula: [
      [78, 108, 164, 0.240],   // azul frío — el campo profundo
      [120, 138, 172, 0.150],  // plata — el medio difuso
      [166, 132, 74, 0.130],   // oro — la aurora, la única nota cálida
      [58, 84, 132, 0.195],    // azul lejano — la profundidad de atrás
    ],
    /* El río baja de 0.185 a 0.115 A PROPÓSITO, y no es un retroceso: al
       0.185 la banda leía como un manchón gris cruzando la pantalla —
       barrido pintado, no cielo. En una placa real la Vía Láctea es densa
       porque tiene MÁS ESTRELLAS, no porque alguien pasó un pincel. Así que
       la presencia se mueve de la pintura al polvo: menos banda, 1.7x más
       puntos (dustMul). Mismo peso visual, y ahora resiste que te acerques. */
    river: { edge: '104,128,172', spine: '62,78,110', aEdge: 0.072, aSpine: 0.115 },
    dust: { base: '#3E4150', bright: '#1A1C24', aFar: 0.34, aMid: 0.55, aNear: 0.78 },
    dustMul: 1.7,
    micro: '#5A6072', aMicro: 0.20,
    node: '#2B2D36', nodeHi: '#15171E',
    halo: '38,40,52',
    haloA: 0.20,
    spike: '48,50,62', aSpike: 0.15,
    glow: '255,255,255',        // luz de ventana — insinuada, no inundando
    vignette: '108,104,116',    // la bóveda: sólo de día (ver la nota arriba)
  },
}

/* El TINT de ruta es una temperatura clara (hueso / plata / estrella) y de
   día tiene que leerse como tinta o las líneas de la constelación —la tesis
   entera del dibujo— desaparecen contra el papel. Mismo papel semántico,
   otro extremo de la escala. */
const TINT_LIGHT = {
  '242,238,230': '58,58,66',
  '199,201,209': '74,76,85',
  '232,233,237': '42,44,51',
}
const tintFor = (theme, tint) => (theme === 'light' ? (TINT_LIGHT[tint] || '74,76,85') : tint)

/* route → surface register. Overrides (a world's own sky) win over this. */
function presetForPath(path) {
  if (path === '/c4' || path.startsWith('/e/')) return { density: 'dense', tint: '242,238,230', seed: 'c4-stage' }
  if (path === '/') return { density: 'medium', tint: '242,238,230', seed: 'the-rooms' }
  if (path.startsWith('/community')) return { density: 'medium', tint: '199,201,209', seed: 'the-creative-universe' }
  if (path.startsWith('/user/') || path.startsWith('/profile')) return { density: 'medium', tint: '199,201,209', seed: 'a-world' }
  if (path.startsWith('/experience') || path.startsWith('/editions')) return { density: 'medium', tint: '242,238,230', seed: 'the-archive' }
  if (path.startsWith('/messages')) return { density: 'quiet', tint: '232,233,237', seed: 'the-conversations' }
  if (path.startsWith('/os')) return { density: 'quiet', tint: '232,233,237', seed: 'the-instrument' }
  /* v12 — /settings es superficie de LECTURA: donde se lee, la galaxia se
     calla. Va en la tabla de rutas y no por useCosmosOverride a propósito:
     el override existe para cielos DINÁMICOS (un mundo que se tiñe con su
     oficio) y se aplica después del montaje, lo que dispara el crossfade
     completo. Una ruta estática no debería pagar un fundido para llegar al
     mismo sitio donde ya iba a caer. */
  if (path.startsWith('/settings')) return { density: 'quiet', tint: '199,201,209', seed: 'the-machine-room' }
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

/* =========================================================================
   EL DPR — LA CAUSA RAÍZ DEL BUG DEL IPHONE (v12.2).

   El síntoma que reportó Diego: en iPhone la galaxia se veía plana / a
   medias, y SÓLO se ponía nítida mientras hacía pinch-zoom; al soltar,
   volvía a verse mal.

   LA CAUSA A — ESTE NÚMERO. Aquí decía `Math.min(2, devicePixelRatio)`.
   Los iPhone desde el X reportan devicePixelRatio = 3. Así que el respaldo
   del canvas se construía a 2x mientras la pantalla pedía 3x:

       (w·2 · h·2) / (w·3 · h·3)  =  4/9  =  44%

   El canvas llevaba el 44% de los píxeles que la pantalla necesitaba, y el
   compositor lo estiraba. Eso es "plano y a medias", exactamente. No era
   una impresión: es menos de la mitad de la información.

   POR QUÉ NADIE LO VIO ANTES — y por qué yo tampoco: en un Mac
   devicePixelRatio es 2, y `Math.min(2, 2)` da 2. La fracción sale 1.0,
   perfecta. El bug es INVISIBLE en el aparato donde se desarrolla y severo
   en el aparato donde se usa. Medido en los dos.

   EL TOPE AHORA LO PONE EL ÁREA, no un número mágico. Un teléfono a 3x son
   ~3 Mpx (barato); un monitor de 2560 a 3x serían 10 Mpx para decoración.
   Así que los viewports chicos —los teléfonos— reciben su DPR nativo
   completo, y los grandes se quedan en 2 como estaban.
   ========================================================================= */
export function canvasDpr(w, h) {
  const native = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  // 1.2e6 px CSS ≈ cualquier cosa más grande que un teléfono en horizontal
  return (w * h > 1.2e6) ? Math.min(2, native) : Math.min(3, native)
}

/* ¿VA A CORRER EL PARALLAX? Una sola función para las dos preguntas que
   antes se respondían por separado —el guard del efecto y la promoción de
   capa del estilo— y que por eso pudieron contradecirse durante meses: el
   efecto decía "en táctil no corro" y el estilo decía "voy a animarme toda
   la vida". Con una sola fuente ya no se pueden desmentir. */
function parallaxRuns(presetMouse) {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return !!presetMouse
    && window.matchMedia('(pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
  // El canvas 2D es el ÚNICO consumidor de color de la app que no puede leer
  // una variable CSS — un contexto 2D toma literales y `var(--x)` no pinta
  // nada (sin lanzar, que es lo peor). Por eso aquí el tema es un valor de
  // JavaScript y no un token, y por eso ThemeProvider cuelga arriba de esto.
  const { resolved: theme } = useTheme()
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
  const RAW_TINT = /^\d{1,3},\d{1,3},\d{1,3}$/.test(cfg.tint) ? cfg.tint : '199,201,209'
  const TINT = tintFor(theme, RAW_TINT)
  const PAL = SKY[theme] || SKY.dark
  // `theme` entra en la llave: cambiar de registro tiene que reconstruir el
  // cielo Y volver a resolver el caché de fondo (las dos paletas conviven en
  // el Map, así que ir y venir entre día y noche no repaga el raster).
  const cfgKey = `${cfg.density}|${TINT}|${cfg.seed}|${theme}`
  // memoizado: matchMedia en cada render sería trabajo por nada, y esto sólo
  // puede cambiar cuando cambia el registro de la superficie.
  const parallaxOn = useMemo(() => parallaxRuns(preset.mouse), [preset.mouse])
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
    // v12 desktop: the 60fps decision was made for a phone and never
    // reconsidered against AREA. A full-canvas blit at 2560x1440@66fps is
    // ~974 Mpx/s against ~42 Mpx/s on a 390px phone — 23x, for a background.
    // Above ~2.2 Mpx of viewport the sky drops to ~30fps; the drift is
    // 0.16px/frame and the parallax is a lean, both of which read identically
    // at 30. Nobody can see the difference; the laptop fan can.
    const bigViewport = window.innerWidth * window.innerHeight > 2.2e6
    const frameMs = preset.fixedCount ? 66 : (finePointer && !bigViewport ? 15 : 31)

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
      // el color sale de la paleta: resplandor en el vacío, mancha de tinta
      // en la placa. Un sprite por registro, construido en el build.
      g.addColorStop(0, `rgba(${PAL.halo},1)`)
      g.addColorStop(1, `rgba(${PAL.halo},0)`)
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
      const dpr = canvasDpr(w, h)
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
      /* v12 desktop density. The old formula scaled by WIDTH, so the sky got
         thinner the bigger the screen: ~42 nodes per megapixel on a phone,
         ~11 per megapixel at 2560 — the same field stretched over 4x the
         area, which is why desktop reads empty. Scaling by sqrt(area) keeps
         the designed density. The 72 ceiling is non-negotiable: links are
         O(n²), and 72 nodes is already 2,556 distance checks per frame. */
      const n = preset.fixedCount ?? Math.round(Math.min(72, Math.max(14, Math.sqrt(w * h) / 26)) * preset.k)
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
      // `theme` va también: día y noche son dos bitmaps distintos del mismo
      // mundo, y los dos merecen quedarse en el caché.
      const key = `${w}x${h}|${TINT}|${cfg.seed}|${preset.sky}|${theme}`
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
      /* The BACKGROUND raster is capped at 1.5x on desktop, not 2x. Everything
         painted into it is low-frequency — a void gradient, four nebula clouds,
         one soft river — plus sub-pixel dust. None of it carries an edge that
         2x resolves and 1.5x does not; it is the one layer in the app where
         the extra samples buy literally nothing visible. It buys 44% of the
         memory back on the machine with the biggest canvas.

         v12.2 — LA PARTE DE "PHONES KEEP 2x" ERA JUSTO EL BUG. El párrafo de
         arriba sigue siendo cierto para ESCRITORIO y ahí no se toca. Pero en
         teléfono la frase "nada aquí tiene bordes" dejó de ser verdad cuando
         v12 metió el POLVO: ~500 puntos de radio 0.35–1.25px son bordes puros,
         y son exactamente lo que se veía suave. En un viewport chico el raster
         es barato, así que sigue al canvas principal y va a DPR nativo. */
      const bigView = w * h > 1.0e6
      const dpr = bigView ? Math.min(1.5, window.devicePixelRatio || 1) : canvasDpr(w, h)
      bgCanvas = document.createElement('canvas')
      bgCanvas.width = Math.round(w * dpr)
      bgCanvas.height = Math.round(h * dpr)
      const b = bgCanvas.getContext('2d')
      b.setTransform(dpr, 0, 0, dpr, 0, 0)
      const g = b.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, PAL.grad[0])
      g.addColorStop(0.55, PAL.grad[1])
      g.addColorStop(1, PAL.grad[2])
      b.fillStyle = g
      b.fillRect(0, 0, w, h)
      // El lavado superior. De noche es la temperatura de la ruta entrando
      // por arriba; de día es luz de ventana — blanca, no teñida, porque un
      // tinte claro sobre papel claro es una mancha y no una fuente.
      const glowRGB = PAL.glow || TINT
      // 0.14, no 0.5 — ver la nota (1) en SKY.light. Media docena de puntos
      // de más aquí y el cielo entero vuelve a ser una hoja.
      const glowA = theme === 'light' ? 0.14 : 0.055
      const glow = b.createRadialGradient(w * 0.5, h * 0.04, 0, w * 0.5, h * 0.04, Math.max(w, h) * 0.7)
      glow.addColorStop(0, `rgba(${glowRGB},${glowA})`)
      glow.addColorStop(1, `rgba(${glowRGB},0)`)
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
      b.globalCompositeOperation = PAL.blend
      for (let i = 0; i < PAL.nebula.length; i++) {
        const [r, gg, bb, a] = PAL.nebula[i]
        const cx = w * (0.12 + srnd() * 0.78)
        // keep the mass out of the reading band: top third or bottom sixth
        const cy = srnd() < 0.7 ? h * (0.02 + srnd() * 0.32) : h * (0.82 + srnd() * 0.2)
        const rad = diag * (0.34 + srnd() * 0.36)
        const peak = a * sky
        /* V12.1 — LOS FILAMENTOS. Cuatro nubes redondas leen como cuatro
           manchas; una nebulosa real tiene HEBRA, se estira en una dirección.
           Dos de las cuatro se dibujan bajo una escala no uniforme y un giro
           propio, así que la misma parada de gradiente produce una banda
           alargada en vez de un círculo. Cuesta un save/restore y ni un solo
           píxel más de relleno — y es la diferencia entre "hay algo detrás"
           y "hay una nube ahí". */
        const filament = i % 2 === 1
        b.save()
        if (filament) {
          b.translate(cx, cy)
          b.rotate(-0.5 + srnd() * 1.0)
          b.scale(1, 0.34 + srnd() * 0.2)
          b.translate(-cx, -cy)
        }
        const cloud = b.createRadialGradient(cx, cy, 0, cx, cy, rad)
        cloud.addColorStop(0, `rgba(${r},${gg},${bb},${peak})`)
        cloud.addColorStop(0.42, `rgba(${r},${gg},${bb},${peak * 0.38})`)
        cloud.addColorStop(1, `rgba(${r},${gg},${bb},0)`)
        b.fillStyle = cloud
        // Sólo la nube estirada necesita desbordar el viewport (su escala
        // vertical encoge el espacio que el rect cubre). Las redondas se
        // quedan con el rect exacto: expandir las cuatro habría triplicado
        // el relleno del raster en un monitor grande sin cambiar un píxel.
        if (filament) b.fillRect(-diag, -diag, w + diag * 2, h + diag * 2)
        else b.fillRect(0, 0, w, h)
        b.restore()
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
      const RV = PAL.river
      const band = b.createLinearGradient(0, -diag * 0.16, 0, diag * 0.16)
      band.addColorStop(0, `rgba(${RV.edge},0)`)
      band.addColorStop(0.42, `rgba(${RV.edge},${RV.aEdge * sky})`)
      band.addColorStop(0.5, `rgba(${RV.spine},${RV.aSpine * sky})`)   // the spine
      band.addColorStop(0.58, `rgba(${RV.edge},${RV.aEdge * sky})`)
      band.addColorStop(1, `rgba(${RV.edge},0)`)
      b.fillStyle = band
      b.fillRect(-diag, -diag * 0.16, diag * 2, diag * 0.32)
      b.restore()

      // 3. THE DUST — the depth that makes it read as SPACE and not as a
      // gradient. ~420 sub-pixel stars, denser along the river (that is what
      // a galactic band IS), all static. This is the single biggest visual
      // win in the file and it costs exactly one bitmap.
      const DU = PAL.dust
      // dustMul: el registro claro compra su densidad con estrellas en vez de
      // con banda pintada (ver la nota junto a `river` en SKY.light). Sigue
      // siendo raster estático — más puntos aquí no cuestan un solo frame.
      const dustN = Math.round(Math.min(520, Math.max(160, (w * h) / 2600)) * sky * (PAL.dustMul || 1))
      const sinA = Math.sin(ang), cosA = Math.cos(ang)
      // los pocos más brillantes se guardan para las púas de abajo
      const anchors = []
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
        const aa = (m > 0.985 ? DU.aNear : m > 0.9 ? DU.aMid : DU.aFar) * sky
        b.globalAlpha = aa
        b.fillStyle = m > 0.96 ? DU.bright : DU.base   // the brightest lean blue-white
        b.beginPath(); b.arc(x, y, rr, 0, 6.3); b.fill()
        if (m > 0.985 && anchors.length < 4) anchors.push({ x, y, rr })
      }

      /* V12.1 — EL POLVO FINO. La capa anterior tiene tres magnitudes y ahí se
         acaba; entre ellas el fondo queda liso, y un cielo liso lee como
         degradado por bonito que sea el degradado. Esta segunda pasada mete
         ~1.6x más puntos a un radio sub-píxel y una α de un dígito: por
         separado ninguno se ve, juntos son la TEXTURA — la sensación de que
         hay más cielo del que alcanzás a resolver. Es lo más barato del
         archivo (un arc de radio .35 no llena ni un píxel) y lo que más
         "espacio de verdad" compra. Estático: no cuesta un solo frame. */
      const microN = Math.round(dustN * 1.6)
      b.fillStyle = PAL.micro
      b.globalAlpha = PAL.aMicro * sky
      for (let i = 0; i < microN; i++) {
        const x = srnd() * w
        const y = srnd() * h
        b.beginPath(); b.arc(x, y, 0.35 + srnd() * 0.22, 0, 6.3); b.fill()
      }

      /* V12.1 — LAS PÚAS. Cuatro, nada más, sobre las estrellas más brillantes
         del campo: dos trazos finos en cruz que se desvanecen a los extremos.
         Es el artefacto del telescopio (la difracción en las arañas del
         secundario) y es LA señal que el ojo lee como "esto es una fotografía
         astronómica" y no como puntos en una pantalla. Cuatro es la cifra
         entera: a la sexta ya es un adorno navideño, y el encargo dice museo,
         no circo. */
      const SP = PAL.spike
      b.lineWidth = 0.7
      for (const a of anchors) {
        const len = a.rr * (7 + srnd() * 5)
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const gsp = b.createLinearGradient(a.x - dx * len, a.y - dy * len, a.x + dx * len, a.y + dy * len)
          gsp.addColorStop(0, `rgba(${SP},0)`)
          gsp.addColorStop(0.5, `rgba(${SP},${PAL.aSpike * sky})`)
          gsp.addColorStop(1, `rgba(${SP},0)`)
          b.strokeStyle = gsp
          b.beginPath()
          b.moveTo(a.x - dx * len, a.y - dy * len)
          b.lineTo(a.x + dx * len, a.y + dy * len)
          b.stroke()
        }
      }

      b.globalAlpha = 1
      b.globalCompositeOperation = 'source-over'

      /* LA BÓVEDA (sólo de día). En el vacío los bordes caen a negro por su
         cuenta y no hace falta nada; en papel no cae nada, y una pantalla
         claro-uniforme de borde a borde lee como una hoja pegada al vidrio,
         no como un espacio con fondo. Un oscurecimiento muy bajo en las
         esquinas es lo que le da bóveda — el mismo truco que usa una copia
         de galería para que la vista caiga al centro.
         Va al FINAL y en source-over, encima del campo profundo: la viñeta
         tiene que abrazar la nebulosa y el polvo, no quedar debajo de ellos.
         El centro se queda intacto (parada 0.5 todavía en alpha 0), así que
         no le roba contraste a nada de lo que se lee. */
      if (PAL.vignette) {
        const vg = b.createRadialGradient(w * 0.5, h * 0.46, 0, w * 0.5, h * 0.46, Math.hypot(w, h) * 0.72)
        vg.addColorStop(0, `rgba(${PAL.vignette},0)`)
        vg.addColorStop(0.5, `rgba(${PAL.vignette},0)`)
        vg.addColorStop(0.78, `rgba(${PAL.vignette},${0.085 * sky})`)
        vg.addColorStop(1, `rgba(${PAL.vignette},${0.20 * sky})`)
        b.fillStyle = vg
        b.fillRect(0, 0, w, h)
      }

      /* v12 desktop: the cap was reasoned from a PHONE (~5MB/entry). At
         2560x1440 DPR2 one entry is 5120x2880x4B = 59 MB, so the same cap
         meant ~295 MB of backing store for decoration on a laptop.

         v12.2 — EL CUPO ES DE MEMORIA, NO DE ENTRADAS. Contar entradas fue
         siempre una aproximación del dato que de verdad importa (bytes), y se
         rompió sola en cuanto el DPR de teléfono subió de 2 a 3: la misma
         "4 entradas" pasó de ~21 MB a ~48 MB sin que nadie tocara el número.
         Un presupuesto en bytes no se puede desincronizar así, porque mide
         justo lo que se quiere limitar. Se expulsa por LRU hasta caber. */
      const BYTES = (cv) => cv.width * cv.height * 4
      const BUDGET = 40e6   // ~40 MB de decoración, en cualquier aparato
      bgCache.current.set(key, bgCanvas)
      let used = 0
      for (const cv of bgCache.current.values()) used += BYTES(cv)
      while (used > BUDGET && bgCache.current.size > 1) {
        const oldestKey = bgCache.current.keys().next().value
        used -= BYTES(bgCache.current.get(oldestKey))
        bgCache.current.delete(oldestKey)
      }
    }

    const draw = (dtFrames) => {
      const w = window.innerWidth
      const h = window.innerHeight
      if (!bgCanvas) buildBg(w, h)
      if (!bgCanvas) return
      ctx.drawImage(bgCanvas, 0, 0, w, h)
      const linkA = preset.linkA
      /* v12 desktop: the link and pointer radii were fixed pixel constants
         tuned on a phone. At 2560 the stars sit far enough apart that a 120px
         reach connects almost nothing — the constellation stops drawing its
         own lines, which is the whole thesis, and the desktop-only pointer
         link mostly finds no node at all. Both now scale with the diagonal
         and stay clamped so a phone is untouched. */
      const diagN = Math.hypot(w, h)
      const LINK_R = Math.max(120, Math.min(260, diagN * 0.085))
      const MOUSE_R = Math.max(150, Math.min(320, diagN * 0.105))
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
            if (d < LINK_R) {
              // the deck link law: alpha (1 - d/R) × register ceiling
              ctx.globalAlpha = (1 - d / LINK_R) * linkA
              ctx.strokeStyle = `rgb(${TINT})`
              ctx.lineWidth = 0.6
              ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke()
            }
          }
        }
        if (preset.mouse && !reduced) {
          const mdx = p.x - mx, mdy = p.y - my
          const md = Math.sqrt(mdx * mdx + mdy * mdy)
          if (md < MOUSE_R) {
            // the sky reacts to whoever is looking at it (D4)
            ctx.globalAlpha = (1 - md / MOUSE_R) * 0.4
            ctx.strokeStyle = PAL.node
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
          ctx.globalAlpha = PAL.haloA * tw
          ctx.drawImage(haloSprite, p.x - hr, p.y - hr, hr * 2, hr * 2)
        }
        ctx.globalAlpha = p.a * tw
        ctx.fillStyle = p.halo ? PAL.nodeHi : PAL.node
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
    if (!parallaxRuns(preset.mouse)) return undefined
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

  /* =======================================================================
     LA CAUSA B DEL BUG DEL IPHONE — `will-change` SOBRE ALGO QUE NO SE MUEVE.

     Este objeto llevaba `willChange: 'transform'` SIEMPRE, con el comentario
     "these layers animate for the app's whole life — the one legitimate use".
     Eso es cierto en escritorio y FALSO en teléfono: el efecto de parallax
     que lo justifica hace early-return en táctil (`pointer: fine`), o sea que
     en cada iPhone se promovían DOS capas del tamaño del viewport para una
     animación que jamás corre.

     Por qué eso produce el síntoma exacto de "sólo se ve HD con zoom":
     `will-change` fuerza al compositor a rasterizar la capa por separado y
     guardarla. Con dos capas de viewport completo + el canvas + el grano +
     cada superficie con backdrop-filter, iOS Safari se pasa del presupuesto
     de memoria de compositor y responde RASTERIZANDO LAS CAPAS A MENOR
     ESCALA. Al hacer pinch, Safari re-rasteriza a la escala del gesto y todo
     se ve nítido; al soltar, vuelve a la escala reducida y se ve mal otra
     vez. Es exactamente lo que Diego describió, incluido el "y al volver
     queda a medias".

     Ahora la promoción se declara sólo cuando la animación de verdad va a
     correr. Y de paso, sin parallax no hay recorrido que cubrir, así que el
     sangrado de -28px también se va: la capa deja de rasterizar el viewport
     más 56px de más en cada eje.
     ======================================================================= */
  const layer = {
    position: 'fixed',
    inset: parallaxOn ? '-28px' : 0,
    pointerEvents: 'none',
    backgroundRepeat: 'repeat',
    transition: 'opacity .8s ease',
    ...(parallaxOn ? { willChange: 'transform' } : null),
  }

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
