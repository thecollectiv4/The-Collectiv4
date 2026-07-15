import { useState, useEffect } from 'react'

/* =========================================================================
   Viewport rule (codified after the half-screen QA round):

   WORK surfaces (/os) are FLUID from 768px up — the instrument shell (rail +
   main, centered dialogs, no bottom nav) always renders at >=768px, because
   real humans run half-screen windows and a 1024px "desktop" gate falsely
   hands them the phone pattern. Below 768px is the real phone pattern.
   CONSUMER surfaces stay mobile-first (the 430px frame) and never key on
   these hooks. Density then adapts in steps, not at one cliff:

     >=768px   — instrument shell (rail + main), centered dialogs
     >=1100px  — the board's four lanes fit as a grid (below: snap-scroll row)
     >=1180px  — the rail runs full-width (below: icon-only, ~64px)
   ========================================================================= */
export const DESKTOP_QUERY = '(min-width: 768px)'
export const BOARD_GRID_QUERY = '(min-width: 1100px)'
export const RAIL_QUERY = '(min-width: 1180px)'
// CONSUMER surfaces get a real desktop architecture from 1024px up (the
// editorial wide mode — museum grid, top header, full canvas). Below that
// they keep the phone pattern. 1024 (not 768): a half-screen window reads
// better as the phone composition than as a cramped editorial spread.
export const WIDE_QUERY = '(min-width: 1024px)'
// >=1440px — the editorial spread breathes into a third column (the For You
// masonry goes 2→3). One consumer step up from WIDE_QUERY, same system.
export const VERY_WIDE_QUERY = '(min-width: 1440px)'

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : true
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/* >=768px — the instrument shell (never the phone pattern / bottom nav). */
export function useIsDesktop() {
  return useMediaQuery(DESKTOP_QUERY)
}

/* >=1180px — full rail; below, the rail collapses to icon-only (~64px). */
export function useRailFull() {
  return useMediaQuery(RAIL_QUERY)
}

/* >=1100px — the board's 4 lanes as a grid; below, a horizontal snap row. */
export function useBoardGrid() {
  return useMediaQuery(BOARD_GRID_QUERY)
}

/* >=1024px — consumer wide mode: editorial desktop architecture. */
export function useWide() {
  return useMediaQuery(WIDE_QUERY)
}

/* >=1440px — the widest consumer spread (For You masonry: 2 cols → 3). */
export function useVeryWide() {
  return useMediaQuery(VERY_WIDE_QUERY)
}
