# 006 — The WorldBuilder's conversation breathes (beats crossfade, the plan assembles)

- **Status**: DONE
- **Commit**: 2e47930
- **Severity**: HIGH
- **Category**: Missed opportunities
- **Estimated scope**: 2 files (WorldBuilder.jsx, index.css), ~30 lines

Depends on: plan 001 (tokens). Plays well after plan 002 (the builder shell's entrance).

## Problem

The guided builder is a first-run, once-per-member flow — the highest delight budget in the frequency table — and its beats are hard cuts:

1. **Question → question**: advancing `meetIdx` swaps kicker/chrome-title/why-copy/input instantly (src/components/WorldBuilder.jsx:418-441 — the `stage === 'meet'` block renders `MEET[meetIdx]` with no keyed transition).
2. **The climax teleports**: `stage === 'compose'` shows a spinner ("composing your world…", lines 486-490), then `stage === 'plan'` cuts straight to the fully-formed "COMPOSED FOR YOU" reveal (494-506) — the app presents the world it composed for you, and it arrives like a spreadsheet refresh.

```jsx
/* src/components/WorldBuilder.jsx:418-424 — current: hard swap on meetIdx */
{stage === 'meet' && (() => {
  const q = MEET[meetIdx]
  ...
  <div className="no-scrollbar" style={{ padding: ..., overflowY: 'auto', position: 'relative', flex: 1, minHeight: 0 }}>
```

```jsx
/* src/components/WorldBuilder.jsx:495-509 — current: the plan appears fully formed */
{stage === 'plan' && plan && (
  <>
    <div className="no-scrollbar" style={{ ... }}>
      <div style={{ fontFamily: 'DM Mono', fontSize: '8px', ... }}>composed for you</div>
      <div style={{ fontFamily: 'Bebas Neue', ... , ...chromeDisplayText }}>
        {plan.kind === 'sound' ? 'A SOUND WORLD' : ...}
      </div>
      <p style={{ ... }}>...</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <PlanRow label="the order" value={...} />
        <PlanRow label="suggested skin" value={plan.skin} />
        {plan.marquee && <PlanRow label="suggested welcome" value={...} />}
```

## Target

**Beat crossfade** — a blur-masked entrance for each conversational beat (the blur hides the two-state swap; 2px is the catalog's masking value):

```css
/* target — src/index.css, add after the CEREMONY block (plan 005) */
/* builder beats — each question surfaces like a thought, not a slide deck */
@keyframes beatIn { from { opacity:0; transform:translateY(8px); filter:blur(2px); } to { opacity:1; transform:translateY(0); filter:blur(0); } }
.beat-in { animation: beatIn 300ms var(--ease-house); }
```

Reduced-motion block addition: `.beat-in { animation: fadeIn .2s ease; }`

```jsx
/* target — WorldBuilder.jsx meet block: key the beat content by question */
<div key={meetIdx} className="beat-in">
  {/* kicker, chrome title, why-copy, input/CraftPicker/SHOW options — the existing children, unchanged */}
</div>
```

Wrap the question content (from the kicker div through the input/options, currently lines ~432-441+) in one keyed div INSIDE the scrolling container, so the transcript block above (meetIdx > 0, lines 425-431) stays stable and only the question re-animates.

**The plan assembles** — when `stage === 'plan'` mounts, the composition appears in sequence (reuse plan 005's `.rise` grammar — same values, same reduced-motion fallback):

- "composed for you" kicker: `rise`
- Chrome title ("A SOUND WORLD"…): `rise rise-1`
- Body copy: `rise rise-2`
- The PlanRow column: each `PlanRow` gets `rise` + inline `style={{ animationDelay: `${280 + i * 60}ms` }}` (pass the index; 60ms steps inside the 30–80ms stagger window). The rows assemble after the title settles — the world composing itself, the constellation thesis in UI form.
- The footer buttons (Use this composition / adjust): `rise` with `animationDelay: '520ms'`.

## Repo conventions to follow

- `.rise` and its reduced-motion fallback come from plan 005 — do not redefine them; if plan 005 hasn't run yet, add the same CEREMONY block verbatim from that plan first.
- Keyed-remount-for-animation is the house pattern (Layout.jsx:202, OS.jsx:357).
- The builder's inline styles stay inline (this file's convention); only classNames and animationDelay are added.

## Steps

1. src/index.css — add `beatIn`/`.beat-in` + the reduced-motion line.
2. src/components/WorldBuilder.jsx meet block (~418-441) — wrap the per-question content in `<div key={meetIdx} className="beat-in">` as specified, leaving the transcript rows outside the keyed wrapper.
3. src/components/WorldBuilder.jsx plan block (~495-509) — add `rise`/`rise-N`/inline delays per Target. `PlanRow` calls get their index (`.map` or manual 0/1/2).
4. Also apply `.beat-in` keyed on `stage` to the compose spinner block (~486-490) so spinner→plan crossfades rather than cuts: wrap the compose block's inner content in `<div className="beat-in">` (it mounts once per compose).

## Boundaries

- Do NOT touch builder logic: `meetNext`, `compose()`, plan state, the steps stage (`stage === 'steps'`), or the header/meter (the meter is plan 008's scaleX fix — leave `width` transition alone here).
- Do NOT add exit animations (React unmounts kill them) or new state.
- No dependencies; CSS + className only, except the two keyed wrapper divs.
- If a cited line doesn't match (drift since 2e47930), STOP and report.

## Verification

- **Mechanical**: `npm run build` passes.
- **Feel check** (dev: open the builder as a member without a world, or via edit-world):
  - Advance through the 3 questions: each new question surfaces with a soft 8px rise and a 2px blur resolving — no hard swap, and the quiet transcript above does NOT re-animate.
  - Finish → compose → plan: the chrome title settles, then the order/skin/welcome rows assemble one by one (~60ms apart), then the footer. Total under ~800ms.
  - At 10% speed: blur fully resolves by animation end (no lingering softness).
  - Reduced motion ON: beats fade with no rise/blur; plan rows appear together (delays collapse per plan 005's fallback).
- **Done when**: no hard cuts remain in meet/compose/plan, reduced-motion degrades to fades, build passes.
