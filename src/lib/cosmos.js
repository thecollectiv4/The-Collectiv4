/* =========================================================================
   Cosmos design tokens — the locked palette + type for the internal surfaces
   (Team OS). void · bone · chrome-on-display-type-only · Bebas / DM Mono /
   DM Sans. Function over decoration. Shared so /os stays consistent without
   re-declaring the block on every file (as the older pages do).
   ========================================================================= */
export const VOID = '#0A0A0D'
export const VOID_2 = '#0B0B10'
export const BONE = '#F2EEE6'
export const BONE_MID = '#9B9891'
export const BONE_LOW = '#5B5952'
export const SILVER = '#C7C9D1'
export const STAR = '#E8E9ED'
export const CARD = '#0E0E13'
export const CARD_HI = '#14141B'
export const HAIR = 'rgba(242,238,230,0.08)'
export const HAIR_HI = 'rgba(242,238,230,0.15)'
export const WARN = '#E5A0A0'

// chrome — ONLY on display type (never fills, never large areas).
export const CHROME = 'linear-gradient(176deg,#EEF0F4 0%,#BFC2CB 20%,#83868F 40%,#F7F9FD 52%,#7E818A 63%,#CED1DA 82%,#9497A0 100%)'
export const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

export const FONT_DISPLAY = "'Bebas Neue', sans-serif"
export const FONT_MONO = "'DM Mono', monospace"
export const FONT_SANS = "'DM Sans', sans-serif"

// Team OS domain constants
export const FALL_001_ISO = '2026-08-28'            // Fall 001 — the north star date
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
