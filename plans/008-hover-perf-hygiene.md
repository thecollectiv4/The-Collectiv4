# 008 — Hover & paint hygiene: kill `transition: all`, layout-property hovers, and perpetual box-shadow paints

- **Status**: TODO
- **Commit**: 2e47930
- **Severity**: MEDIUM
- **Category**: Performance + Accessibility + Interruptibility
- **Estimated scope**: ~20 files, mechanical sweep + 1 new CSS pattern

Depends on: plan 001 (tokens).

## Problem

Four verified paint/compositing sins, all high-occurrence:

**A. `transition: 'all'` — 47 sites.** Animates unintended properties off-GPU. Worst single case: the shared OS button primitive, whose inline `all` overrides the deliberately scoped CSS rule at src/index.css:172:

```jsx
/* src/components/os/ui.jsx:98 — current (the Btn primitive, every OS button) */
<button onClick={onClick} disabled={disabled} style={{ ..., transition: 'all .15s', ...v, ...style }}>
```

**B. Hover animates `padding-left` (layout property) via JS handlers** — full-width rows reflow (text re-wraps) for 200ms on every hover, and the JS `onMouseOver` fires on touch taps (no `(hover: hover)` gate possible from JS), sticking rows in their hover state:

```jsx
/* src/components/CreateCentral.jsx:213-215 — current (same pattern at all sites listed below) */
style={{ ..., transition: 'padding-left .2s ease' }}
onMouseOver={(e) => { e.currentTarget.style.paddingLeft = '10px' }}
onMouseOut={(e) => { e.currentTarget.style.paddingLeft = '2px' }}
```

**C. Infinite `box-shadow` keyframes on the public event hero** — repaints forever while the page is open, un-gated for reduced motion:

```jsx
/* src/pages/EventLanding.jsx:241-243 — current */
<div style={{ ..., animation:'countPulse 3s infinite' }} ...>
  <div style={{ ..., animation:'pulse 2s infinite', boxShadow:'0 0 8px rgba(199,201,209,.5)' }} />
/* also line 206: the LIVE dot, animation:'pulse 2s infinite' */
```

**D. `discBreathe` snaps on un-hover** — the keyframe is applied only while hovered; leaving mid-cycle removes it and the transform jumps from up to scale(1.045) back to 1:

```css
/* src/index.css:234 — current */
.disc-card:hover .disc-banner img, .disc-card:hover .disc-banner svg { animation: discBreathe 6s ease-in-out infinite; }
```

Plus three small ones: progress meters animate `width` (src/components/WorldBuilder.jsx:413, src/components/ProfileMuseum.jsx:948); `.salon-piece` hover scale is missing from both the `(hover: none)` and reduced-motion blocks (src/index.css:242-243 vs 245-261); `glowPulse` (index.css:77) is dead code with zero users.

## Target

**A — explicit property lists.** Every `transition: 'all …'` becomes the properties that actually change at that site. The Btn primitive first:

```jsx
/* target — ui.jsx:98 */
transition: 'color .15s, background .15s, border-color .15s, opacity .15s, filter .15s, transform .16s var(--ease-exit)',
```

Full site list (from audit, verify each before editing — the hover handler at each site tells you which properties to list):
- AuthModal.jsx: 73, 103 · CraftPicker.jsx: 85, 161 · ForYou.jsx: 199 · ProfileMuseum.jsx: 643, 815, 826, 831, 836, 841, 849, 885, 953, 996, 1086, 1114, 1426, 1589 · TasteBrainstorm.jsx: 111, 166, 197 · WorldBuilder.jsx: 448, 602, 648 · WorldOffer.jsx: 96 · os/Events.jsx: 259 · os/Moderation.jsx: 157 · os/ui.jsx: 98 · Auth.jsx: 63, 77 · Community.jsx: 188, 332, 357 · EventLanding.jsx: 230, 332, 488, 522 · Events.jsx: 126 · ExperienceDetail.jsx: 74, 131 · Messages.jsx: 672, 822 · NetworkAdmin.jsx: 156, 175 · Profile.jsx: 229, 283

Rule of thumb while sweeping: hover swaps of `background`/`borderColor`/`color`/`opacity` → list exactly those; if the handler also swaps `boxShadow` or a gradient `background` (EventLanding.jsx:230's badge), transition **border-color only** and let the paint-heavy properties snap.

**B — the catalog-row lead becomes a gated CSS class** (one class, replaces every padding-left hover):

```css
/* target — src/index.css, after the PRESSABLE block */
/* catalog rows lead with the whole row on hover — transform, never padding
   (padding reflows); gated so touch taps don't stick a fake hover. */
.row-lead { transition: transform var(--dur-fast) var(--ease-house), border-color var(--dur-fast) var(--ease-house); }
@media (hover: hover) and (pointer: fine) {
  .row-lead:hover { transform: translateX(8px); }
  .row-lead:hover:active { transform: translateX(8px) translateY(1px) scale(.99); }
}
.row-lead:not(:disabled):active { transform: translateY(1px) scale(.99); }
@media (prefers-reduced-motion: reduce) {
  .row-lead, .row-lead:hover, .row-lead:hover:active, .row-lead:active { transform: none; }
}
```

At each site: add `className="row-lead"` (replacing `pressable` if present — `.row-lead` includes the press settle, avoiding transform collisions), delete the `onMouseOver`/`onMouseOut` padding handlers, and remove `padding-left`/`all` from the inline `transition`. Sites (verify each): CreateCentral.jsx:213-215 + 244-246 · EventLanding.jsx:425-427 + 565-566 · Messages.jsx:502-504 + 528-530 · Events.jsx:210-212 · ProfileMuseum.jsx:643-645 + 1426-1428 (these two also swap borderColor in the same handlers — keep the borderColor swap in JS or move to the class; simplest: keep JS borderColor swap, delete only the padding mutation).

**C — glow as an opacity pseudo-element + reduced-motion gate:**

```css
/* target — src/index.css: replace countPulse usage; the shadow renders once, opacity animates */
.glow-pulse { position: relative; }
.glow-pulse::after { content:''; position:absolute; inset:-2px; border-radius:inherit; box-shadow:0 0 14px 4px rgba(242,238,230,.10); opacity:0; animation: glowFade 3s ease-in-out infinite; pointer-events:none; }
@keyframes glowFade { 0%,100% { opacity:0; } 50% { opacity:1; } }
```

EventLanding.jsx:241 — remove `animation:'countPulse 3s infinite'` from the style, add `className="glow-pulse"`. The two `pulse` dots (206, 243) move to a class `pulse-dot { animation: pulse 2s infinite; }` so they're gateable. Reduced-motion block: `.glow-pulse::after, .pulse-dot { animation: none; }`. Delete the now-unused `countPulse` keyframe (index.css:76) and the dead `glowPulse` (index.css:77).

**D — breathe pauses instead of snapping:**

```css
/* target — src/index.css:232-234 */
.disc-banner img, .disc-banner svg { transform-origin: 50% 50%; animation: discBreathe 6s ease-in-out infinite; animation-play-state: paused; }
.disc-card:hover .disc-banner img, .disc-card:hover .disc-banner svg { animation-play-state: running; }
```

(Un-hover freezes the scale mid-cycle — no snap; re-hover resumes. The existing reduced-motion line at index.css:260 keeps working — extend it to `animation: none` on the base selector too.)

**Small fixes:** progress meters → `width: '100%'`, `transform: scaleX(${pct/100})`, `transformOrigin: 'left'`, `transition: 'transform .5s var(--ease-house)'` (WorldBuilder.jsx:413, ProfileMuseum.jsx:948). `.salon-piece` → add `.salon-piece:hover img { transform: none; }` to the `(hover: none)` block and `.salon-piece img { transition: none; }` to the reduced-motion block.

## Repo conventions to follow

- Inline styles stay inline; only the `transition` values and hover handlers change. New shared behavior goes to index.css classes (the `.disc-*` block at 219-248 is the exemplar of hover-in-CSS done right).
- Durations/curves from plan 001 tokens wherever a value is touched.

## Steps

1. src/index.css — add `.row-lead`, `.glow-pulse`/`glowFade`, `.pulse-dot`; convert `discBreathe` to play-state; delete `countPulse` + `glowPulse` keyframes; extend the reduced-motion and `(hover:none)` blocks as specified.
2. src/components/os/ui.jsx:98 — fix the Btn primitive first (highest blast radius).
3. Sweep B sites (row-lead conversion), verifying each excerpt before editing.
4. Sweep the remaining `transition: 'all'` sites file by file with the rule of thumb.
5. EventLanding pulses (C), progress meters, salon-piece gates.

## Boundaries

- Zero visual redesign: the same states, same colors, same distances — only which properties animate and how they're triggered changes.
- Do NOT touch `.temp-warm`/`.temp-electric`/`osNowPulse`/`osMicPulse` (documented identity registers, already reduced-motion gated; their box-shadow technique is accepted for now).
- Do NOT edit ProfileMuseum's framer code (plan 007).
- If any listed line doesn't match its excerpt (drift since 2e47930), skip that site and report it — finish the rest.

## Verification

- **Mechanical**: `npm run build` passes. `grep -rn "transition: 'all\|transition:'all" src/ | wc -l` returns 0. `grep -n "countPulse\|glowPulse" src/` returns nothing.
- **Feel check**:
  - CREATE doors / Events archive / Messages composer rows: hover leads 8px right (transform), text no longer re-wraps mid-hover (compare a long row title). On a touch device (or DevTools device mode), tapping a row does NOT leave it shifted.
  - /e/<slug>: countdown pill still glows on a 3s cycle; in DevTools Performance, the hero at idle shows no per-frame paint from the pill.
  - Discover: hover a card, leave mid-breathe — the image freezes and eases back on re-hover; no snap.
  - Reduced motion ON: no glow cycle, no pulse dots, no row shifts, no breathe.
- **Done when**: zero `transition: all` in src/, no layout-property hovers, hero pulses are composite-only and gated, build passes.
