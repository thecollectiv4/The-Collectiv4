/* =========================================================================
   Cosmos design tokens — the locked palette + type for the internal surfaces
   (Team OS). void · bone · chrome-on-display-type-only · Bebas / DM Mono /
   DM Sans. Function over decoration. Shared so /os stays consistent without
   re-declaring the block on every file (as the older pages do).
   ========================================================================= */
/* Token values are the alignment deck's (collectiv4-universe.html) — the deck
   is the reference; the OS must read as that deck become an app. */
export const VOID = '#0A0A0D'
export const VOID_2 = '#07080E'
export const BONE = '#F2EEE6'
export const BONE_MID = '#C7C4BC'                    // deck --bone-dim
export const BONE_LOW = '#83838F'                    // deck --ash
export const FAINT = '#4C4C57'                       // deck --faint
export const SILVER = '#C7C9D1'
export const STAR = '#E8E9ED'
export const PANEL = 'rgba(242,238,230,.022)'        // deck --panel
export const CARD = 'rgba(242,238,230,.025)'
export const CARD_HI = 'rgba(242,238,230,.05)'
export const HAIR = 'rgba(242,238,230,0.08)'         // deck --line-soft
export const HAIR_HI = 'rgba(242,238,230,0.15)'      // deck --line
export const WARN = '#E5A0A0'

// chrome — ONLY on display type (never fills, never large areas). Deck .chrome.
export const CHROME = 'linear-gradient(100deg,#F6F6FA 0%,#A6ABBA 26%,#FCFCFE 50%,#8E94A6 73%,#EFEFF4 100%)'
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
