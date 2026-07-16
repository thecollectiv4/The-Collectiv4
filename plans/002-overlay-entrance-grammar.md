# 002 — One entrance grammar for every overlay (sheets rise, panels dock, dialogs settle, menus grow from their trigger)

- **Status**: TODO
- **Commit**: 2e47930
- **Severity**: HIGH
- **Category**: Physicality & origin + Missed opportunities
- **Estimated scope**: 7 files (index.css + 6 JSX), ~60 lines

Depends on: plan 001 (tokens).

## Problem

Every hand-rolled overlay in the app teleports in fully formed. Spatially-anchored surfaces (bottom sheets, a right-docked studio panel, a trigger-anchored menu) show no motion explaining where they came from — the single most-touched seam that makes the app "feel like any other app".

```jsx
/* src/components/os/ui.jsx:23-24 — current: the shared OS Modal, zero entrance */
<div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(7,8,14,.78)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', padding: desktop ? '40px' : 0 }}>
  <div onClick={e => e.stopPropagation()} role="dialog" aria-label={title}
```

```jsx
/* src/pages/Messages.jsx:693-696 — current: backdrop fades, the sheet itself teleports */
<div onClick={() => { if (!busy) onClose() }} aria-hidden
  style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(7,8,14,.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'fadeIn .25s ease' }} />
<div role="dialog" aria-modal="true" aria-label={label}
  style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: '460px', zIndex: 10000, ... }}>
```

```jsx
/* src/components/CreateCentral.jsx:90 — current: one fadeIn on the whole overlay; the sheet has no rise */
<div onClick={...} style={{ position: 'fixed', inset: 0, zIndex: 10005, background: 'rgba(7,8,14,.8)', backdropFilter: 'blur(6px)', ..., alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center', animation: 'fadeIn .25s ease' }}>
  <div onClick={(e) => e.stopPropagation()} ref={dialogRef} ... style={{ ...shell, outline: 'none' }}>
```

```jsx
/* src/components/WorldBuilder.jsx:385-387, 399 — current: no entrance in either variant */
const shell = wide
  ? { position: 'fixed', top: '56px', right: 0, bottom: 0, width: '480px', zIndex: 10000, ... }
  : { position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: '430px', zIndex: 10000, ... }
...
<div role="dialog" aria-label="Build your world" style={shell}>
```

```jsx
/* src/components/os/Drops.jsx:87-89 — current: feedback dialog, no animation at all */
<div ... style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(7,8,14,.78)', ... }}>
  <div ... style={{ position: 'relative', width: '100%', maxWidth: '460px', ... }}>
```

```jsx
/* src/components/os/Board.jsx:269-270 — current: trigger-anchored assign menu pops in, no origin */
<div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10001 }} />
<div data-testid="board-owner-menu" role="menu" style={{ position: 'fixed', ...pos, zIndex: 10002, ... }}>
```

## Target

One CSS grammar in src/index.css (entrances only — these components unmount on close, exit animation is out of scope):

```css
/* ============================================================
   OVERLAY GRAMMAR — everything arrives from somewhere (Ley 13).
   Sheets rise from the bottom edge; docked panels arrive from
   their edge; centered dialogs settle; menus grow from their
   trigger. Entrances only — overlays unmount on close.
   NO `forwards` fills (see the page-transition note above) except
   where opacity:0 start requires it and the element cannot contain
   fixed descendants (menus).
   ============================================================ */
@keyframes overlayFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sheetUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes sheetUpCentered { from { transform: translateX(-50%) translateY(24px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
@keyframes panelInRight { from { transform: translateX(32px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes dialogIn { from { transform: scale(.97); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes menuIn { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.overlay-backdrop { animation: overlayFade var(--dur-base) var(--ease-exit); }
.sheet-up { animation: sheetUp 320ms var(--ease-drawer); }
.sheet-up-centered { animation: sheetUpCentered 320ms var(--ease-drawer); }
.panel-in-right { animation: panelInRight 300ms var(--ease-exit); }
.dialog-in { animation: dialogIn var(--dur-base) var(--ease-exit); }
.menu-in { animation: menuIn 160ms var(--ease-exit); }
```

And in the existing reduced-motion block (src/index.css:250-261), add:

```css
  .sheet-up, .sheet-up-centered, .panel-in-right, .dialog-in, .menu-in { animation: overlayFade .2s ease; }
```

(Reduced motion keeps the opacity fade — comprehension feedback — and drops movement.)

## Repo conventions to follow

- Section banner comments with `============` rails, like the PRESSABLE block at src/index.css:103-107.
- Overlay transforms must respect existing inline `transform: translateX(-50%)` centering — that is why `sheetUpCentered` exists. A keyframe's `transform` replaces the inline one during the animation; the centered variant carries the centering through every frame.
- The `NO forwards` constraint (src/index.css:92-97) is settled law: sheets/dialogs may contain `position:fixed` descendants, so their keyframes end at natural values with no fill. `menuIn`/`dialogIn` also end at natural values — no fill needed anywhere.

## Steps

1. src/index.css — add the keyframes + classes block after the PRESSABLE block (~line 110), and the one reduced-motion line inside the block at 250-261.
2. src/components/os/ui.jsx (~23-24, the `Modal` primitive) — add `className="overlay-backdrop"` to the outer fixed div; on the inner dialog div add `className={desktop ? 'dialog-in' : 'sheet-up'}` (it is bottom-anchored on mobile via `alignItems: flex-end`).
3. src/pages/Messages.jsx (~693-696, the `Sheet`) — backdrop div: replace `animation: 'fadeIn .25s ease'` in style with `className="overlay-backdrop"`; dialog div: add `className="sheet-up-centered"` (it carries inline `transform: translateX(-50%)`).
4. src/components/CreateCentral.jsx (~90) — keep `animation: 'fadeIn .25s ease'` OFF the outer div: replace with `className="overlay-backdrop"`. Inner shell div: add `className={wide ? 'dialog-in' : 'sheet-up'}`.
5. src/components/WorldBuilder.jsx (~399) — on the `role="dialog"` div add `className={wide ? 'panel-in-right' : 'sheet-up-centered'}` (the phone variant carries inline `translateX(-50%)`; the wide studio panel docks from the right edge).
6. src/components/os/Drops.jsx (~87-89) — outer fixed div: `className="overlay-backdrop"`; inner panel: `className="dialog-in"`.
7. src/components/os/Board.jsx (~270, the owner menu) — add `className="menu-in"` and an inline `transformOrigin` on the menu div: `transformOrigin: openUp ? 'left bottom' : 'left top'` (the `openUp` boolean already exists just above at the `pos` computation, ~line 264 — it decides whether the menu opens above or below the chip). The menu grows from the trigger's side, per the popover origin rule.

## Boundaries

- Entrances only. Do NOT build exit animations, do NOT add unmount orchestration or new state.
- Do NOT change z-indexes, layout, markup structure, or any non-motion style.
- Do NOT touch AuthModal (it already has a correct centered entrance, `fadeUp .3s` at src/components/AuthModal.jsx:57).
- If a cited line doesn't match (drift since 2e47930), STOP and report.

## Verification

- **Mechanical**: `npm run build` passes. Grep confirms no remaining `animation: 'fadeIn` on the six touched overlay containers.
- **Feel check** (dev server, mobile viewport 375px + desktop 1280px):
  - Tap + (CREATE): on phone the sheet rises ~24px from the bottom edge while the backdrop fades; on desktop the dialog settles from scale(.97). No jump, no double-fade.
  - /messages → open a crew/plan sheet: sheet rises, stays horizontally centered every frame (no left-snap — that means the centered keyframe variant is missing).
  - /profile → build/edit world: phone sheet rises; at ≥1024px the studio panel slides in 32px from the right.
  - /os → Board → click an owner chip: menu grows from the chip's corner (flip `openUp` by scrolling near the bottom — origin must flip too).
  - In DevTools Animations panel at 10% speed: every entrance starts fast and decelerates (ease-out family), nothing bounces.
  - Reduced motion ON: overlays fade in place; zero translate/scale.
- **Done when**: all six overlays animate in per the grammar, reduced-motion shows fade-only, build passes.
