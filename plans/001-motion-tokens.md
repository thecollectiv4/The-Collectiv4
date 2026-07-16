# 001 — Introduce motion tokens (the house curve becomes law)

- **Status**: TODO
- **Commit**: 2e47930
- **Severity**: HIGH
- **Category**: Cohesion & tokens
- **Estimated scope**: 2 files (src/index.css, src/lib/cosmos.js), ~40 lines

## Problem

The app has zero motion tokens — `:root` in src/index.css:7-38 defines only colors. Motion speaks four dialects:

```css
/* src/index.css:79-83 — current: legacy entrances on weak built-in `ease` */
.fade-up   { animation: fadeUp 0.55s ease forwards; }
.fade-up-1 { animation: fadeUp 0.55s ease 0.1s forwards; opacity:0; }
.fade-up-2 { animation: fadeUp 0.55s ease 0.2s forwards; opacity:0; }
.fade-up-3 { animation: fadeUp 0.55s ease 0.3s forwards; opacity:0; }
.fade-up-4 { animation: fadeUp 0.55s ease 0.45s forwards; opacity:0; }
```

```css
/* src/index.css:98-101 — current: the app's most-seen motion, weak `ease` */
.page-transition { animation: pageIn 0.35s ease; }
.page-slide-right { animation: slideInRight 0.3s ease; }
.page-slide-left { animation: slideInLeft 0.3s ease; }
.page-scale { animation: scaleIn 0.3s ease; }
```

```css
/* src/index.css:143-144, 152-153, 226, 242 — current: "the deck's curve" hand-typed 5× */
.os-reveal { opacity:0; animation: osReveal .95s cubic-bezier(.2,.7,.2,1) forwards; }
.os-reveal-fast { opacity:0; animation: osReveal .5s cubic-bezier(.2,.7,.2,1) forwards; }
.os-slide-in-right { animation: osSlideInRight .4s cubic-bezier(.2,.7,.2,1); }
.disc-card { transition: transform .5s cubic-bezier(.2,.7,.2,1), border-color .5s ease; }
.salon-piece img { transition: transform .8s cubic-bezier(.2,.7,.2,1); }
```

```js
// src/components/ProfileMuseum.jsx:100-105 — current: a hand-typed near-miss of the house curve
const reveal = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.7, ease: [0.22, 0.61, 0.36, 1] },
}
```

Plus ~50 inline hand-typed values in JSX (`transition: 'all .2s'`, `.25s ease`, `.15s`, `.18s`…). Every future motion fix re-hand-types values until tokens exist. The house curve — the brand's motion signature — is missing exactly where users look most (page transitions, the event hero).

## Target

CSS tokens in `:root`, mirrored as JS exports in src/lib/cosmos.js (the repo's established pattern: index.css:8-9 documents that CSS vars mirror cosmos.js):

```css
/* target — add inside the existing :root block, src/index.css:7 */
  /* Motion — the deck's curve is the house signature; strong ease-out for
     overlay entrances (per-surface). Durations are a scale, not a free-for-all. */
  --ease-house:  cubic-bezier(.2, .7, .2, 1);      /* reveals, slides, hovers — the deck */
  --ease-exit:   cubic-bezier(0.23, 1, 0.32, 1);   /* strong ease-out — overlay/dialog entrances */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);   /* sheets rising from the bottom edge */
  --dur-press:   160ms;
  --dur-fast:    200ms;
  --dur-base:    250ms;
  --dur-slow:    500ms;
  --dur-cinematic: 950ms;                          /* the deck's .95s reveal — rare, deliberate */
```

```js
// target — append to src/lib/cosmos.js after the FONT_* exports
// Motion — mirrors the :root tokens in index.css (same rule as the palette:
// one source of truth, two notations). House curve = the deck's.
export const EASE_HOUSE = 'cubic-bezier(.2, .7, .2, 1)'
export const EASE_HOUSE_ARR = [0.2, 0.7, 0.2, 1]     // framer-motion notation
export const EASE_EXIT = 'cubic-bezier(0.23, 1, 0.32, 1)'
export const EASE_DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)'
export const DUR = { press: 160, fast: 200, base: 250, slow: 500, cinematic: 950 } // ms
```

Then repoint the index.css classes to the tokens **without changing any computed value except the weak easings**:

```css
/* target — src/index.css:79-83: same durations/delays, house curve instead of `ease` */
.fade-up   { animation: fadeUp 0.55s var(--ease-house) forwards; }
.fade-up-1 { animation: fadeUp 0.55s var(--ease-house) 0.1s forwards; opacity:0; }
.fade-up-2 { animation: fadeUp 0.55s var(--ease-house) 0.2s forwards; opacity:0; }
.fade-up-3 { animation: fadeUp 0.55s var(--ease-house) 0.3s forwards; opacity:0; }
.fade-up-4 { animation: fadeUp 0.55s var(--ease-house) 0.45s forwards; opacity:0; }

/* target — src/index.css:143-144, 152-153 */
.os-reveal { opacity:0; animation: osReveal var(--dur-cinematic) var(--ease-house) forwards; }
.os-reveal-fast { opacity:0; animation: osReveal var(--dur-slow) var(--ease-house) forwards; }
.os-slide-in-right { animation: osSlideInRight .4s var(--ease-house); }
.os-slide-in-left { animation: osSlideInLeft .4s var(--ease-house); }

/* target — src/index.css:226, 242: tokenized, values unchanged */
.disc-card { transition: transform var(--dur-slow) var(--ease-house), border-color var(--dur-slow) ease; }
.salon-piece img { transition: transform .8s var(--ease-house); }

/* target — src/index.css:108: tokenized (timing asymmetry is plan 010, NOT here) */
.pressable { transition: transform var(--dur-press) ease, opacity var(--dur-press) ease; }
```

Do NOT retime `.page-*` here — plan 003 owns those classes (duration + logic changes together).

## Repo conventions to follow

- Comment style: block comments explaining intent, like the palette note at src/index.css:8-11.
- cosmos.js exports are SCREAMING_SNAKE constants with trailing comments (see `VOID`, `CHROME` at src/lib/cosmos.js).
- The deck's curve is documented at src/index.css:141 ("the deck's curve exactly") — keep that comment.

## Steps

1. src/index.css — add the 8 motion custom properties at the end of the existing `:root` block (after `--success`, line ~38), with the comment shown in Target.
2. src/index.css — repoint `.fade-up*` (79-83), `.os-reveal*` (143-144), `.os-slide-in-*` (152-153), `.disc-card` (226), `.salon-piece img` (242), `.pressable` (108) exactly as shown in Target.
3. src/lib/cosmos.js — append the six motion exports after the `FONT_SANS` export (line ~32), with the comment shown in Target.
4. Do not touch any JSX file. Inline call sites migrate opportunistically in plans 002–010.

## Boundaries

- Do NOT change any duration, delay, or distance — only easing functions move (from built-in `ease`/hand-typed beziers to tokens). The single visible change is `.fade-up*` gaining the house curve.
- Do NOT touch `.page-*` classes (plan 003) or `@keyframes` definitions.
- Do NOT add dependencies.
- If a cited line doesn't match the excerpt (drift since 2e47930), STOP and report.

## Verification

- **Mechanical**: `npm run build` completes without errors. `grep -c "var(--ease-house)" src/index.css` ≥ 8.
- **Feel check**: open http://localhost:5173/e/<any-published-slug> — the hero's fade-up sequence should land with a crisper settle (fast start, long tail) instead of the mushy symmetric `ease`. /os reveals and Discover hover must look IDENTICAL to before (values unchanged).
- Toggle `prefers-reduced-motion` (DevTools → Rendering) — behavior unchanged from before this plan.
- **Done when**: tokens exist in both files, the six class groups reference them, and build passes.
