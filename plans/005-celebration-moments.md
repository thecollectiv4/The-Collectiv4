# 005 — The celebration moments earn their delight budget (YOU'RE IN · IT LIVES IN YOUR WORLD)

- **Status**: DONE
- **Commit**: 2e47930
- **Severity**: HIGH
- **Category**: Missed opportunities
- **Estimated scope**: 3 files (ClaimWorld.jsx, CreateCentral.jsx, index.css), ~70 lines

Depends on: plan 001 (tokens).

This is a "surprise" plan: rare, high-emotion moments currently render flat. The register is **editorial procession — museum, not party**: staged reveals on the house curve. No bounce, no confetti, no springs.

## Problem

**A. ClaimWorld — the post-purchase "YOU'RE IN"** is a hard state flip. The spinner phase (src/pages/ClaimWorld.jsx:95-103) cuts instantly to the fully-formed confirmed layout:

```jsx
/* src/pages/ClaimWorld.jsx:144-148 — current: everything appears at once */
<div style={{ width: '52px', height: '52px', margin: '0 auto', borderRadius: '50%', border: `1px solid ${SILVER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 26px rgba(199,201,209,.22)' }}>
  <Check size={22} style={{ color: STAR }} />
</div>
...
<h1 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(40px,13vw,56px)', lineHeight: .88, margin: '12px 0 0', ...chromeText }}>
  {firstName ? `YOU'RE IN, ${firstName.toUpperCase()}` : "YOU'RE IN"}
</h1>
```

Below it: the kicker (~line 147), body copy (~151), ticket chip (~161), CTA (~173) — all teleport in together. A verified real ticket is the rarest, highest-emotion moment in the product.

**B. CreateCentral's `Done` stage** ("IT LIVES IN YOUR WORLD" / "IT'S ON THE WALL") — the member just published something into their world, and the closing moment appears as a dry conditional swap:

```jsx
/* src/components/CreateCentral.jsx:135-148 — current: static */
function Done({ kicker, title, line, cta, onCta, onClose }) {
  return (
    <div style={{ position: 'relative', padding: '44px 28px 40px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ {kicker}</div>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: '40px', lineHeight: .95, marginTop: '14px', ...chromeText }}>{title}</div>
      <p style={{ ... }}>{line}</p>
      <button className="pressable" onClick={onCta} style={{ ... }}>{cta}</button>
      <button onClick={onClose} style={{ ... }}>done</button>
```

## Target

**Shared CSS** (src/index.css — add after the overlay grammar block from plan 002):

```css
/* ============================================================
   CEREMONY — the rare moments (ticket confirmed, work published)
   arrive as an editorial procession: the mark draws itself, then
   each line settles in turn. House curve, no bounce (anti-corny).
   ============================================================ */
@keyframes riseIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
.rise { opacity:0; animation: riseIn var(--dur-slow) var(--ease-house) forwards; }
.rise-1 { animation-delay: 120ms; } .rise-2 { animation-delay: 200ms; }
.rise-3 { animation-delay: 280ms; } .rise-4 { animation-delay: 360ms; } .rise-5 { animation-delay: 440ms; }
@keyframes ringDraw { from { stroke-dashoffset: 164; } to { stroke-dashoffset: 0; } }
.ring-draw { stroke-dasharray: 164; animation: ringDraw 600ms var(--ease-house) forwards; }
```

Reduced-motion block addition: `.rise { animation: fadeIn .3s ease forwards; } .rise-1,.rise-2,.rise-3,.rise-4,.rise-5 { animation-delay: 0ms; } .ring-draw { animation: none; stroke-dashoffset: 0; }`

NOTE on `forwards`: `.rise` needs the fill because of the delayed `opacity:0` start — same accepted pattern as `.os-reveal` (index.css:143). These ceremony containers must not hold `position:fixed` descendants (they don't — verified static content).

**CORRECTION (found during execution):** a filled animation outranks inline styles AND class rules, so `.rise` on an *interactive* element permanently suppresses its own `:active`/hover transform (the ClaimWorld CTA's `hoverIn` lift, `.pressable`'s press settle). **Never put `.rise` on a button.** Wrap it: `<div className="rise rise-N" style={{ marginTop: <the button's margin>, display: 'flex' }}>` around the button, with the button's own `marginTop: 0`. The `display: flex` avoids both margin-collapse and the inline-block descender gap.

**A. ClaimWorld confirmed state** — replace the check circle with an SVG ring that draws itself, then stagger the procession:

```jsx
/* target — the mark: a 52px ring drawing clockwise, check fading in after */
<svg width="52" height="52" viewBox="0 0 52 52" style={{ display: 'block', margin: '0 auto' }} aria-hidden>
  <circle className="ring-draw" cx="26" cy="26" r="25.5" fill="none" stroke={SILVER} strokeWidth="1"
    transform="rotate(-90 26 26)" style={{ filter: 'drop-shadow(0 0 10px rgba(199,201,209,.25))' }} />
</svg>
{/* the Check icon overlays the ring, fading in as the draw completes: wrap both in a
    position:relative div; the check gets className="rise" with animationDelay: '450ms' */}
```

(Circumference 2π·25.5 ≈ 160.2 — the 164 dasharray covers it; keep 164.)

Then: kicker `rise rise-1`, `<h1>` `rise rise-2`, body `<p>` `rise rise-3`, ticket chip `rise rise-4`, CTA + secondary links `rise rise-5`. The chrome moment stays the headline alone (Ley 8 — the ring is stroke silver, not chrome).

**B. CreateCentral Done** — same grammar, faster (the sheet is already up):

kicker `rise` (no extra delay), title `rise rise-1`, line `rise rise-2`, CTA `rise rise-3`, "done" link `rise rise-4`.

## Repo conventions to follow

- Stagger via numbered modifier classes mirrors the existing `.fade-up-1..4` pattern (index.css:80-83).
- Chrome restraint: do not add glow/chrome to anything new; the SILVER/STAR palette constants come from src/lib/cosmos.js (already imported in both files).
- `aria-hidden` on decorative SVG, as done throughout (e.g. Board.jsx lane rail).

## Steps

1. src/index.css — add the CEREMONY block + reduced-motion additions.
2. src/pages/ClaimWorld.jsx (~144-186) — swap the check-circle div for the ring SVG + overlaid check (markup change is allowed here, scoped to this block); add `rise rise-N` classes to kicker/h1/p/chip/CTA as specified. The `shell()` wrapper and all logic stay untouched.
3. src/components/CreateCentral.jsx (~135-148, the `Done` component) — add `rise`/`rise-N` classes as specified. No structural change.

## Boundaries

- Do NOT touch the `confirming`/`loggedout`/`missing` phases or any data/webhook logic in ClaimWorld.
- Do NOT animate the stage swaps inside CreateCentral (that is plan 006's crossfade grammar; only the `Done` component is in scope here).
- No new dependencies, no framer-motion here — CSS only.
- If a cited line doesn't match (drift since 2e47930), STOP and report.

## Verification

- **Mechanical**: `npm run build` passes.
- **Feel check**:
  - Simulate the confirmed state (visit /claim with a confirmed ticket in dev, or temporarily hardcode `phase = 'confirmed'` — revert after): the ring draws over ~600ms, the check surfaces, then YOU'RE IN → copy → chip → CTA settle in sequence over ~1s total. It should read as a procession, not a bounce reel.
  - At 10% speed: each element starts fast and decelerates; nothing overshoots.
  - Post something via CREATE: "IT LIVES IN YOUR WORLD" cascades in under ~700ms.
  - Reduced motion ON: elements fade in place (no rise), ring appears fully drawn, delays collapse to 0 — the moment still reads celebratory via the sequence-free fade.
- **Done when**: both ceremonies stage in on the house curve, reduced-motion degrades to fades, build passes.
