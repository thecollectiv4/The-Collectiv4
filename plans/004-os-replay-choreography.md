# 004 — Stop replaying the OS entrance choreography on every action

- **Status**: TODO
- **Commit**: 2e47930
- **Severity**: HIGH
- **Category**: Purpose & frequency + Interruptibility
- **Estimated scope**: 5 files (OS.jsx, Board.jsx, ContentEngine.jsx, Brain.jsx, index.css), ~50 lines

Depends on: plan 001 (tokens).

## Problem

The OS's staged entrance (`.os-reveal` .95s + stagger) is beautiful once. But it is wired to mount, and the OS remounts constantly:

```jsx
/* src/pages/OS.jsx:351-357 — current: every tab switch remounts the pane */
const slideClass = tabIdx > prevTabIdx.current ? 'os-slide-in-right' : tabIdx < prevTabIdx.current ? 'os-slide-in-left' : 'os-reveal-fast'
...
<div key={tab} className={slideClass}>
  {tab === 'board' && <Board ... />}
```

```jsx
/* src/components/os/Board.jsx:106, 110 — current: lanes replay the .95s stagger on every tab visit */
<section key={col.key} ... className={`os-reveal${dragOver === col.key ? ' os-lane-over' : ''}`}
  ... style={{ ..., animationDelay: `${ci * 70}ms`, ... }}>
```

```jsx
/* src/components/os/Board.jsx:204-208 — current: rows carry the entrance permanently */
<div className={`os-card os-reveal-fast${dragging ? ' os-dragging' : ''}`} tabIndex={0}
  draggable
  ...
  style={{ ..., animationDelay: `${delay}ms`, ... }}>
/* delay = ci * 70 + i * 35 (fed at Board.jsx:130) */
```

Three concrete failures, all verified:

1. **Tab switching** (100+×/day): `key={tab}` remounts Board/ContentEngine → the full staggered choreography replays stacked on the .4s slide. A 20-card ContentEngine pane doesn't settle for ~1.8s, dozens of times a day (`src/components/os/ContentEngine.jsx:24` has the same `os-reveal` + `i*45ms` pattern).
2. **Moving a card** (drop / SHIP / arrows): the row remounts under the new lane's `<section>`, so the entrance keyframe restarts **with a fresh stagger delay** — `.os-reveal-fast` holds `opacity:0` until `ci*70+i*35`ms elapses. The card the user just acted on vanishes for up to ~400ms, then fades up from 20px below. The action's own feedback is hidden by an entrance.
3. **The Brain dock** (keyboard: B key, src/pages/OS.jsx:275-287): `dockOpen &&` remounts the whole transcript — every bubble replays `os-reveal-fast` (src/components/os/Brain.jsx:192) and the YOUR TODAY hero replays the .95s `os-reveal` (Brain.jsx:161). Keyboard-frequency actions must not animate. Sending a message also gives the user's own bubble a 500ms/20px rise (`key={i}` append).

## Target

- The staggered reveal plays **once per tab per OS session** (first visit). Re-entries get only the short pane slide.
- Moved/created board cards appear **instantly**, with a brief settle pulse instead of an entrance.
- Brain transcript never replays; only a genuinely new message gets a small 4px fade-rise; the YOUR TODAY hero animates only on the brain tab's first visit, never in the dock.
- Pane slide drops from .4s/18px to 200ms/10px (it keeps direction — Ley 13 — but at daily-use scale).

```css
/* target — src/index.css:150-153 */
@keyframes osSlideInRight { from { opacity:0; transform:translateX(10px); } to { opacity:1; transform:translateX(0); } }
@keyframes osSlideInLeft { from { opacity:0; transform:translateX(-10px); } to { opacity:1; transform:translateX(0); } }
.os-slide-in-right { animation: osSlideInRight var(--dur-fast) var(--ease-house); }
.os-slide-in-left { animation: osSlideInLeft var(--dur-fast) var(--ease-house); }
```

```css
/* target — new, add after the os-card rules (~src/index.css:168) */
/* a moved/created card SETTLES — feedback, not an entrance (no delay, no rise) */
@keyframes osSettle { from { transform: scale(.98); border-color: rgba(242,238,230,.28); } to { transform: scale(1); } }
.os-settle { animation: osSettle var(--dur-fast) var(--ease-house); }
```

```jsx
/* target — src/pages/OS.jsx: first-visit tracking (add near prevTabIdx, ~line 349) */
const visitedTabs = useRef(new Set())
const firstVisit = !visitedTabs.current.has(tab)
useEffect(() => { visitedTabs.current.add(tab) }, [tab])
```

Pass `entrance={firstVisit}` to `<Board ... />` and `<ContentEngine ... />` (OS.jsx:358-359), and `entrance={tab === 'brain' && firstVisit}` handling for the brain (see steps).

```jsx
/* target — Board.jsx lane (106): reveal only on first visit */
<section key={col.key} ... className={`${entrance ? 'os-reveal' : ''}${dragOver === col.key ? ' os-lane-over' : ''}`}
  ... style={{ ..., animationDelay: entrance ? `${ci * 70}ms` : undefined, ... }}>
```

```jsx
/* target — Board.jsx TaskRow (204-208): entrance on first visit; settle when moved */
<div className={`os-card ${entrance ? 'os-reveal-fast' : 'os-settle'}${dragging ? ' os-dragging' : ''}`}
  ... style={{ ..., animationDelay: entrance ? `${delay}ms` : undefined, ... }}>
```

(TaskRow re-renders during a visit keep `os-settle`; the keyframe only fires when the node (re)mounts — exactly the move/create case. Thread `entrance` down as a prop from Board.)

```jsx
/* target — Brain.jsx:192: transcript bubbles never animate on mount; only true appends do */
// near the top of the component:
const prevLen = useRef(messages.length)   // initialized to CURRENT length: remounts don't animate
useEffect(() => { prevLen.current = messages.length }, [messages.length])
// in the map — only the newly appended tail animates:
<div key={i} className={i >= prevLen.current ? 'msg-in' : ''} style={{ ... }}>
```

```css
/* target — new, add near the os block: the one message that just arrived */
@keyframes msgIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
.msg-in { animation: msgIn var(--dur-fast) var(--ease-house); }
```

```jsx
/* target — Brain.jsx:161 (YOUR TODAY hero): animate only when the parent says so */
<div className={entrance ? 'os-reveal' : ''} style={{ padding: embedded ? '14px 2px 8px' : '26px 2px 10px' }}>
```

`Brain` receives a new optional prop `entrance` (default `false`). OS.jsx's `brainEl(embedded)` (~line 318) passes `entrance={!embedded && firstVisit}` — the dock (`embedded`) never replays the hero.

Also add `.os-settle, .msg-in { animation: none; }` to the reduced-motion block (src/index.css:250-261).

## Repo conventions to follow

- Props threaded explicitly, camelCase, with a short comment at the destructuring site (see how `delay`, `last` flow through TaskRow at Board.jsx:128-131).
- CSS classes prefixed `os-` inside the instrument, comments in the house voice (see "rows/cards: quiet hover lift — instrument, not brochure" at index.css:164).
- `useRef` init-to-current for "don't animate what was already there" matches the repo's alive-ref/StrictMode awareness (WorldBuilder history notes).

## Steps

1. src/index.css — retime `.os-slide-in-*` (150-153) to 10px / `var(--dur-fast) var(--ease-house)`; add `osSettle`/`.os-settle` and `msgIn`/`.msg-in`; add both to the reduced-motion block.
2. src/pages/OS.jsx — add `visitedTabs`/`firstVisit` (near line 349); pass `entrance={firstVisit}` to `Board` and `ContentEngine`; change `brainEl` to pass `entrance={!embedded && firstVisit}` to `Brain`.
3. src/components/os/Board.jsx — accept `entrance` prop; gate lane `os-reveal` + `animationDelay` on it (line 106, 110); thread `entrance` into `TaskRow` and swap `os-reveal-fast` → conditional `os-reveal-fast`/`os-settle` (204-208), gating `animationDelay` likewise (130, 208).
4. src/components/os/ContentEngine.jsx — accept `entrance`; gate `os-reveal` + `animationDelay: i*45ms` (line 24) the same way.
5. src/components/os/Brain.jsx — add `entrance = false` prop; hero class conditional (161); add the `prevLen` ref and `msg-in` gating on bubbles (192). Do NOT change the `key={i}` scheme.
6. OS.jsx:664 (activity feed rows with `os-reveal-fast` + `i*25ms`) — gate on the same `firstVisit` since the overview remounts per tab too: `className={firstVisit ? 'os-reveal-fast' : ''}` and conditional delay.

## Boundaries

- Do NOT touch drag/drop logic, `dropOn`, `os-dragging`, `os-lane-over`, or any data flow.
- Do NOT change the `.os-reveal` .95s first-visit choreography itself — first visits keep the full cinematic entrance.
- Do NOT persist `visitedTabs` beyond the session (no storage).
- If a cited line doesn't match (drift since 2e47930), STOP and report.

## Verification

- **Mechanical**: `npm run build` passes; `node scripts/roadmap-labels.test.mjs` still passes (OS-adjacent test).
- **Feel check** (dev server, /os as a member):
  - First visit to Board: full staggered reveal, as today. Switch to Content and back: pane slides 200ms, lanes/cards are **already visible** — no re-stagger, no blank cards.
  - Drag a card to another lane / hit SHIP: the card appears in the new lane **instantly** with a subtle scale-settle + border pulse; it never disappears. Watch at 10% speed in the Animations panel: no opacity:0 phase on the moved card.
  - Press B repeatedly: the dock's transcript is stable — zero re-fades. Send a message: only the new bubble fade-rises 4px.
  - Reduced motion ON: no settle pulse, no msg rise; everything still appears instantly.
- **Done when**: tab re-entries replay nothing, moved cards never vanish, Brain transcript animates only true appends, build + test pass.
