import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/* =========================================================================
   EL TEMA — System / Light / Dark (v12).

   Cosmos was born in the void and stays there by default: DARK is the house
   register, not a fallback. Light is the SAME universe seen by day — the
   same constellation, the same river, the same grain, read as graphite on a
   gallery wall instead of bone on the void. It is an INVERSION, never a
   second design system (Ley 8: one universe, one vocabulary).

   THE MECHANISM, and why it is this one:

   · The preference is a THREE-state value (system | light | dark), stored
     once in localStorage. `system` is not a synonym for dark — it tracks the
     OS live, so a phone that flips to dark at sunset flips the app with it
     without anyone opening settings.
   · What actually paints is `data-theme` on <html>, resolved from the pref.
     One attribute, one place; every token in index.css hangs off it. No
     component subscribes to colors — they read CSS vars and re-paint for
     free. That is why 500+ call sites could be flipped without 500 re-renders.
   · The FOUC guard lives in index.html, not here. React mounts a frame or
     three after first paint, so resolving the theme in this file alone means
     a light-mode member eats a black flash on every cold load. The inline
     script writes the attribute before the first pixel; this provider then
     adopts what is already on the element instead of fighting it.

   The canvas is the ONE consumer that cannot read a CSS variable (2D context
   takes literal colors), so Atmosphere subscribes to `resolved` through the
   hook and picks a palette in JS. That is the only place the theme is a
   JavaScript value rather than a token.
   ========================================================================= */

export const THEME_KEY = 'c4:theme'
export const THEMES = ['system', 'light', 'dark']

/* The status-bar / browser-chrome colour per resolved theme. iOS paints the
   notch band with this, so a light session with a void status bar reads as a
   half-migrated app. Values are the two --bg tokens, kept in sync by hand
   (index.html's inline guard carries the same pair — three literals total,
   all three commented). */
export const THEME_COLOR = { dark: '#0A0A0D', light: '#EDEBE6' }

const mq = () => (typeof window !== 'undefined' && window.matchMedia)
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null

export const systemTheme = () => (mq()?.matches ? 'dark' : 'light')

export function readPref() {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return THEMES.includes(v) ? v : 'system'
  } catch { return 'system' }   // private mode / blocked storage → the OS decides
}

export const resolveTheme = (pref) => (pref === 'system' ? systemTheme() : pref)

/* The single writer. Everything that changes the look of the app goes
   through here so the attribute, the status bar and the colour-scheme hint
   can never disagree. `color-scheme` is what makes the NATIVE bits follow —
   form controls, scrollbars, the tap-highlight: without it a light page
   still scrolls with a dark scrollbar. */
export function applyTheme(resolved) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', resolved)
  root.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[resolved] || THEME_COLOR.dark)
}

const ThemeContext = createContext({ pref: 'system', resolved: 'dark', setPref: () => {} })

export function ThemeProvider({ children }) {
  const [pref, setPrefState] = useState(readPref)
  const [sys, setSys] = useState(systemTheme)

  // Track the OS while (and only while) the member is on `system`. The
  // listener stays mounted regardless — cheap, and it keeps `sys` warm so
  // switching back to `system` is instant instead of one frame stale.
  useEffect(() => {
    const m = mq()
    if (!m) return undefined
    const onChange = (e) => setSys(e.matches ? 'dark' : 'light')
    // Safari <14 has no addEventListener on MediaQueryList — the deprecated
    // addListener is the only path there, and this app ships to iPhones.
    if (m.addEventListener) m.addEventListener('change', onChange)
    else m.addListener(onChange)
    return () => {
      if (m.removeEventListener) m.removeEventListener('change', onChange)
      else m.removeListener(onChange)
    }
  }, [])

  const resolved = pref === 'system' ? sys : pref

  useEffect(() => { applyTheme(resolved) }, [resolved])

  const setPref = useCallback((next) => {
    if (!THEMES.includes(next)) return
    setPrefState(next)
    try { localStorage.setItem(THEME_KEY, next) } catch { /* storage blocked — the session still switches, it just won't outlive the tab */ }
  }, [])

  const value = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
