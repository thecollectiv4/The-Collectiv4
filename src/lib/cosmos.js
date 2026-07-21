/* =========================================================================
   Cosmos design tokens — the locked palette + type for the internal surfaces
   (Team OS). void · bone · chrome-on-display-type-only · Bebas / DM Mono /
   DM Sans. Function over decoration. Shared so /os stays consistent without
   re-declaring the block on every file (as the older pages do).
   ========================================================================= */
/* Token values are the alignment deck's (collectiv4-universe.html) — the deck
   is the reference; the OS must read as that deck become an app.

   V12 — LOS NOMBRES SE QUEDAN, LOS VALORES SE MUDARON. Cada constante apunta
   ahora al token de index.css en vez de llevar el literal. Los 18 archivos
   que importan de aquí no cambiaron ni una línea y aun así respetan tema:
   `style={{ color: BONE }}` emite `color: var(--cream)`, que en el vacío es
   hueso y de día es tinta. Ese fue el punto de mantener el módulo compartido.

   LOS VALORES ORIGINALES siguen siendo la fuente de verdad del registro
   oscuro — viven en el bloque `:root` de index.css, comentados con el nombre
   del deck. Aquí sólo queda la indirección.

   ⚠ ESTAS CONSTANTES YA NO SIRVEN PARA CANVAS. Un contexto 2D toma colores
   literales: `ctx.fillStyle = 'var(--cream)'` no lanza, simplemente no pinta.
   Atmosphere.jsx es el único consumidor de canvas de la app y por eso lleva
   su propia paleta en JS — no importa este archivo, y no debe empezar a
   hacerlo. */
export const VOID = 'var(--bg)'
export const VOID_2 = 'var(--bg-deep)'
export const BONE = 'var(--cream)'
export const BONE_MID = 'var(--cream-mid)'           // deck --bone-dim
export const BONE_LOW = 'var(--cream-low)'           // deck --ash
export const FAINT = 'var(--cream-ghost)'            // deck --faint
export const SILVER = 'var(--silver)'
export const STAR = 'var(--star)'
export const PANEL = 'rgba(var(--ink-rgb),.022)'     // deck --panel
export const CARD = 'rgba(var(--ink-rgb),.025)'
export const CARD_HI = 'rgba(var(--ink-rgb),.05)'
export const HAIR = 'rgba(var(--ink-rgb),0.08)'      // deck --line-soft
export const HAIR_HI = 'rgba(var(--ink-rgb),0.15)'   // deck --line
export const WARN = 'var(--warn)'

// chrome — ONLY on display type (never fills, never large areas). Deck .chrome.
// Acero pulido sobre el vacío, metal oscuro grabado sobre papel (index.css).
export const CHROME = 'var(--chrome)'

/* =========================================================================
   LAS TEMPERATURAS, TRADUCIDAS PARA CSS (v12).

   Las "tints" (Ley 14) viven en DATOS como tripletes RGB crudos —
   crafts.js, match.js, CreateCentral, las pestañas del OS— y se consumen de
   dos maneras incompatibles entre sí:

     · CSS    → `rgb(${tint})`, `rgba(${tint},.3)`   … quiere tema
     · CANVAS → Atmosphere, vía useCosmosOverride    … quiere números

   Un contexto 2D toma colores literales, así que la tabla NO se puede
   convertir a variables sin romper el cielo en silencio (el regex de
   Atmosphere lo mandaría a su fallback y nadie se enteraría). Por eso el
   dato se queda crudo y la traducción ocurre en el borde: los consumidores
   de CSS pasan por aquí, el canvas usa el triplete tal cual.

   Se usa poniendo la función DONDE IBA el dato — el resto de la plantilla no
   cambia, y por eso `rgba(...,α)` sigue funcionando igual:

       color: `rgb(${meta.tint})`  →  color: `rgb(${tintChannel(meta.tint)})`

   El fallback es plata: una temperatura desconocida se degrada a legible,
   nunca a invisible. */
const TINT_CHANNEL = {
  '242,238,230': 'var(--tint-bone)',
  '199,201,209': 'var(--tint-silver)',
  '232,233,237': 'var(--tint-star)',
}
export const tintChannel = (tint) => TINT_CHANNEL[tint] || 'var(--tint-silver)'
export const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

export const FONT_DISPLAY = "'Bebas Neue', sans-serif"
export const FONT_MONO = "'DM Mono', monospace"
export const FONT_SANS = "'DM Sans', sans-serif"

// Motion — mirrors the :root tokens in index.css (same rule as the palette:
// one source of truth, two notations). House curve = the deck's.
export const EASE_HOUSE = 'cubic-bezier(.2, .7, .2, 1)'
export const EASE_HOUSE_ARR = [0.2, 0.7, 0.2, 1]     // framer-motion notation
export const EASE_EXIT = 'cubic-bezier(0.23, 1, 0.32, 1)'
export const EASE_DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)'
export const DUR = { press: 160, fast: 200, base: 250, slow: 500, cinematic: 950 } // ms

// Team OS domain constants
export const FALL_001_ISO = '2026-08-28'            // Fall 001 — the north star date
export const CHAPTER_START_ISO = '2026-07-01'       // Fall chapter window opens (roadmap strip origin)
export const BOARD_COLUMNS = [
  { key: 'ideas',     label: 'Ideas' },
  { key: 'this_week', label: 'This Week' },
  { key: 'in_motion', label: 'In Motion' },
  { key: 'done',      label: 'Done' },
]
export const COLUMN_LABEL = Object.fromEntries(BOARD_COLUMNS.map(c => [c.key, c.label]))
export const CONTENT_FORMATS = ['Pro camera', 'iPhone raw', 'Casual in-car', 'Scripted']
export const CONTENT_STATUSES = ['idea', 'planned', 'shot', 'edited', 'posted']

export function daysUntil(iso) {
  const target = new Date(iso + 'T00:00:00')
  const now = new Date()
  const ms = target - new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round(ms / 86400000)
}

export function relTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''

/* =========================================================================
   LA ESTRELLA DEL CÍRCULO ÍNTIMO (v13-polish · decisión de Diego).

   Close friends se dibujaba de tres maneras distintas: la estrella de lucide
   en Messages, una estrella SVG a mano en /connections, y un anillo con
   satélite en ConnectSheet. Un concepto, tres símbolos — el lector tenía que
   aprender la app tres veces.

   Ahora hay UNA estrella y vive acá, no en cada pantalla: quien la use la
   importa. Un solo lugar para cambiarla es la única forma de que no vuelva a
   divergir sola.

   El estado ON no es un color distinto: es la MISMA estrella que se llena y
   se enciende. Todo lo que se mueve es interpolable (fill-opacity, color,
   filter), así que una reversión optimista puede interrumpirla a media
   animación sin saltos — enciende como estrella, no como casilla (A-17). */
export const closeStarStyle = (on) => ({
  fillOpacity: on ? 1 : 0,
  color: on ? STAR : BONE_LOW,
  filter: on ? 'drop-shadow(0 0 6px rgba(var(--star-rgb),.5))' : 'drop-shadow(0 0 0 rgba(var(--star-rgb),0))',
  transition: 'fill-opacity var(--dur-base) var(--ease-house), color var(--dur-base) var(--ease-house), filter var(--dur-base) var(--ease-house)',
})
