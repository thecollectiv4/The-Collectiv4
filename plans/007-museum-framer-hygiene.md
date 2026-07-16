# 007 — Museum framer-motion: hardware-accelerated transforms, reduced-motion, house curve

- **Status**: TODO
- **Commit**: 2e47930
- **Severity**: MEDIUM
- **Category**: Performance + Accessibility + Cohesion
- **Estimated scope**: 1 file (ProfileMuseum.jsx), ~15 line-sites

Depends on: plan 001 (tokens — `EASE_HOUSE_ARR` export from src/lib/cosmos.js).

## Problem

The flagship museum page is the only framer-motion surface, and its preset has three defects:

```jsx
/* src/components/ProfileMuseum.jsx:100-105 — current */
const reveal = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.7, ease: [0.22, 0.61, 0.36, 1] },
}
```

```jsx
/* src/components/ProfileMuseum.jsx:675 — current: 2s main-thread zoom on the full-width cover raster */
<motion.img src={cover} alt="" initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 2, ease: 'easeOut' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
```

1. **Main-thread animation**: framer's `y`/`scale` shorthands are not hardware-accelerated — ~11 scroll-reveals (`{...reveal}` spreads at lines 505, 516, 528, 538, 548, 558, 568, 594, 638, 1129) plus the 2s cover zoom run on the main thread of an image-heavy page and drop frames under load. Animating the full `transform` string composites on the GPU.
2. **Zero reduced-motion**: `useReducedMotion` appears nowhere in src/ (grep-verified). Reduced-motion users get 26px scroll-translations and a 2s zoom on the app's flagship surface — while Atmosphere.jsx treats reduced-motion as "non-negotiable".
3. **Dialect drift**: `[0.22, 0.61, 0.36, 1]` is a hand-typed near-miss of the house curve `[0.2, 0.7, 0.2, 1]`.

## Target

```jsx
/* target — ProfileMuseum.jsx:100-105 */
import { motion, useReducedMotion } from 'framer-motion'   // line 4: add useReducedMotion
import { ..., EASE_HOUSE_ARR } from '../lib/cosmos'         // extend the existing cosmos import

// --- scroll-reveal preset (framer-motion) ---
// full transform strings: GPU-composited (y/scale shorthands run on the main
// thread); reduced-motion collapses to opacity-only. House curve.
const useReveal = () => {
  const reduced = useReducedMotion()
  return {
    initial: { opacity: 0, transform: reduced ? 'none' : 'translateY(26px)' },
    whileInView: { opacity: 1, transform: 'translateY(0px)' },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.7, ease: EASE_HOUSE_ARR },
  }
}
```

Inside the component body: `const reveal = useReveal()` — every `{...reveal}` spread site stays textually identical.

```jsx
/* target — the cover (675): GPU transform string, no zoom under reduced motion */
<motion.img src={cover} alt=""
  initial={{ transform: reducedMotion ? 'scale(1)' : 'scale(1.12)' }}
  animate={{ transform: 'scale(1)' }}
  transition={{ duration: 2, ease: 'easeOut' }}
  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
```

(`const reducedMotion = useReducedMotion()` once in `ProfileMuseum`; the 2s duration is deliberate marketing-budget pace — keep it.)

## Repo conventions to follow

- The preset is defined at module level today; converting to a `useReveal()` hook is required because `useReducedMotion` is a hook. Call it once in `ProfileMuseum` and once in any other component in this file that spreads `{...reveal}` (check `Salon`/section components within the same file — the spread sites at the lines listed above; if a spread site lives in a child component defined in this file, that child calls `useReveal()` itself).
- cosmos.js constants are imported at the top with the existing named import (see line ~6 of the file for the current cosmos import list).

## Steps

1. src/components/ProfileMuseum.jsx:4 — add `useReducedMotion` to the framer import; add `EASE_HOUSE_ARR` to the cosmos import.
2. Replace the `reveal` const (100-105) with the `useReveal` hook; add `const reveal = useReveal()` in each component that spreads it (find every `{...reveal}` — expected at 505, 516, 528, 538, 548, 558, 568, 594, 638, 1129; verify with grep before editing).
3. Line 675 — swap the cover's shorthand props for transform strings, gated by `useReducedMotion` per Target.

## Boundaries

- Do NOT change durations, distances (26px), the `-60px` viewport margin, or `once: true`.
- Do NOT touch any other animation in the file (hover handlers, transitions — plans 008 covers those).
- Do NOT convert the page away from framer-motion.
- If a cited line doesn't match (drift since 2e47930), STOP and report.

## Verification

- **Mechanical**: `npm run build` passes; `grep -c "useReveal()" src/components/ProfileMuseum.jsx` matches the number of components containing spread sites; `grep -c "y: 26" src/components/ProfileMuseum.jsx` returns 0.
- **Feel check** (dev, a profile with cover + gallery):
  - Scroll the museum: reveals look identical to before (26px rise, 0.7s), but in DevTools Performance the animation frames show compositor-only work (no purple layout/style spikes from the reveals).
  - Reduced motion ON (Rendering panel): sections fade in with zero translation; the cover renders at scale(1) with no zoom.
- **Done when**: no `y:`/`scale:` shorthand props remain in the file, reduced-motion is honored, build passes.
