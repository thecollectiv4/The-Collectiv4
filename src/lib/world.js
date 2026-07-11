/* =========================================================================
   world.js — shared vocabulary of a member's WORLD (profile-museum).
   One source of truth for ProfileMuseum (the museum) and WorldBuilder
   (the guided build): normalizers, the welcome marquee, the skins, and
   the completeness math behind "your world is at 60%".
   ========================================================================= */

const BONE = '#F2EEE6'
// display chrome — the museum's own 176deg liquid gradient (kept identical
// to the pre-split ProfileMuseum values so nothing shifts visually)
export const CHROME_DISPLAY = 'linear-gradient(176deg,#EEF0F4 0%,#BFC2CB 20%,#83868F 40%,#F7F9FD 52%,#7E818A 63%,#CED1DA 82%,#9497A0 100%)'
export const chromeDisplayText = { background: CHROME_DISPLAY, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

export function worldSafeUrl(raw) { const u = (raw || '').trim(); return /^https?:\/\//i.test(u) ? u : '' }

export const normGallery = (g) => (Array.isArray(g) ? g.filter(x => x && worldSafeUrl(x.url)) : [])
export const normLinks = (l) => (Array.isArray(l) ? l.filter(x => x && worldSafeUrl(x.url)) : [])

// the welcome marquee (0014 marquee_text): null → the house default,
// empty string → the owner turned the ticker off.
export const DEFAULT_MARQUEE = 'wlcme 2 my wrld'
export const marqueeOf = (t) => (t === '' ? '' : ((t ?? '').trim() || DEFAULT_MARQUEE))

// world skins: composition presets INSIDE cosmos — the display-type
// treatment changes, the palette never does (no per-profile colors).
export const THEMES = [
  { key: 'chrome', label: 'Chrome' },
  { key: 'outline', label: 'Outline' },
  { key: 'bone', label: 'Bone' },
]
export function nameSkin(theme) {
  // outline: fill transparent + stroke. `filter: none` is load-bearing — a
  // drop-shadow filter over stroked transparent text can composite to
  // NOTHING in Chromium (the museum hero carries one for the chrome skin;
  // caught by the walkthrough: the anon world rendered a nameless hero).
  if (theme === 'outline') return { color: 'transparent', WebkitTextStroke: `1.5px ${BONE}`, filter: 'none' }
  if (theme === 'bone') return { color: BONE }
  return chromeDisplayText
}

/* Completeness — what "a built world" means, in points (sums to 100):
   craft 15 · your line 15 · 3 gallery pieces 30 (10 each) · a link 15 ·
   marquee decided 10 · skin chosen 10 · a face 5. Deliberately EXCLUDES
   taste/media/bio — those are curation, not the front door. */
export function worldCompleteness(d) {
  if (!d) return { pct: 0, missing: [] }
  const gallery = normGallery(d.gallery)
  const links = normLinks(d.world_links)
  let pts = 0
  const missing = []
  if ((d.discipline || '').trim()) pts += 15; else missing.push('craft')
  if ((d.tagline || '').trim()) pts += 15; else missing.push('line')
  pts += Math.min(3, gallery.length) * 10
  if (gallery.length < 3) missing.push('work')
  if (links.length) pts += 15; else missing.push('links')
  if (d.marquee_text != null) pts += 10; else missing.push('marquee')
  if (d.world_theme != null) pts += 10; else missing.push('skin')
  if ((d.avatar_url || '').trim()) pts += 5; else missing.push('face')
  return { pct: Math.min(100, pts), missing }
}
