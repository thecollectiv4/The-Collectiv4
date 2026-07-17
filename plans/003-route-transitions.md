# 003 — Route transitions: fast, house-curved, silent on sub-navigation, reduced-motion aware

- **Status**: DONE
- **Commit**: 2e47930
- **Severity**: HIGH
- **Category**: Purpose & frequency + Easing & duration + Accessibility
- **Estimated scope**: 2 files (src/index.css, src/components/Layout.jsx), ~20 lines

Depends on: plan 001 (tokens).

## Problem

The page transition is the most-seen motion in the app — it fires on EVERY navigation, including opening a chat thread the user was already looking at. It is also the weakest-eased, is uninterruptible (keyed remount restarts keyframes from zero on rapid tab-hopping), and has no reduced-motion handling.

```jsx
/* src/components/Layout.jsx:91-100 — current */
useEffect(() => {
  if (isSubPage) {
    setTransClass('page-slide-right')
  } else if (currentIdx > prevIdx.current) {
    setTransClass('page-slide-right')
  } else if (currentIdx < prevIdx.current) {
    setTransClass('page-slide-left')
  } else {
    setTransClass('page-transition')
  }
  if (!isSubPage) prevIdx.current = currentIdx
}, [location.pathname])
```

```jsx
/* src/components/Layout.jsx:202 — current: keyed remount on every pathname */
<div key={location.pathname} className={transClass} style={{ position:'relative', zIndex:1 }}>
```

```css
/* src/index.css:86-101 — current */
@keyframes pageIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes slideInRight { from { opacity:0; transform:translateX(30px); } to { opacity:1; transform:translateX(0); } }
@keyframes slideInLeft { from { opacity:0; transform:translateX(-30px); } to { opacity:1; transform:translateX(0); } }
.page-transition { animation: pageIn 0.35s ease; }
.page-slide-right { animation: slideInRight 0.3s ease; }
.page-slide-left { animation: slideInLeft 0.3s ease; }
```

Concretely: `/messages` → `/messages/:id` keeps `currentIdx === prevIdx.current`, so the whole page replays `pageIn` (12px rise + fade) around content mid-read — the highest-frequency action in the app animating at 350ms. The central reduced-motion block (src/index.css:250-261) does not cover `.page-*`.

## Target

- Same-tab sub-navigation (thread open, back to list): **no page animation at all**.
- Cross-tab moves keep the directional grammar (it has spatial purpose — Ley 13 "connected, never a dry cut") but at high-frequency scale: **200ms, 12px, house curve**.
- Off-tab sub-pages (`/e/:slug`, `/u/:handle` — `isSubPage`) keep the descend-right slide at the same reduced scale.
- `.page-*` joins the reduced-motion block as an opacity-only fade.

```css
/* target — src/index.css:86-101 */
@keyframes pageIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
@keyframes slideInRight { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
@keyframes slideInLeft { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
.page-transition { animation: pageIn var(--dur-fast) var(--ease-house); }
.page-slide-right { animation: slideInRight var(--dur-fast) var(--ease-house); }
.page-slide-left { animation: slideInLeft var(--dur-fast) var(--ease-house); }
/* keep .page-scale and the NO-forwards comment block (92-97) untouched */
```

```jsx
/* target — Layout.jsx:91-100: same-tab navigation goes silent */
useEffect(() => {
  if (isSubPage) {
    setTransClass('page-slide-right')
  } else if (currentIdx > prevIdx.current) {
    setTransClass('page-slide-right')
  } else if (currentIdx < prevIdx.current) {
    setTransClass('page-slide-left')
  } else {
    setTransClass('')            // same tab (e.g. /messages → /messages/:id): no page animation
  }
  if (!isSubPage) prevIdx.current = currentIdx
}, [location.pathname])
```

```css
/* target — add inside the reduced-motion block, src/index.css:250-261 */
  .page-transition, .page-slide-right, .page-slide-left, .page-scale { animation: fadeIn .2s ease; }
```

(`fadeIn` already exists at src/index.css:73.)

## Repo conventions to follow

- The NO-`forwards` comment at src/index.css:92-97 is settled law — keep the comment and the no-fill behavior exactly.
- Direction logic and `prevIdx` ref pattern stay as-is; only the same-index branch changes.

## Steps

1. src/index.css — retime the three keyframes and three classes as shown (8px/12px distances, `var(--dur-fast) var(--ease-house)`).
2. src/components/Layout.jsx:99 — change `setTransClass('page-transition')` to `setTransClass('')` with the comment shown.
3. src/index.css — add the `.page-*` line to the reduced-motion block.

## Boundaries

- Do NOT remove the keyed remount (`key={location.pathname}`) — routes genuinely remount; converting to transition-based crossfades is out of scope.
- Do NOT touch `.os-slide-in-*` (plan 004) or any other class.
- Do NOT change `isSubPage` computation or tab logic.
- If a cited line doesn't match (drift since 2e47930), STOP and report.

## Verification

- **Mechanical**: `npm run build` passes.
- **Feel check** (dev server, mobile viewport):
  - Tap between bottom-nav tabs left→right and right→left: pane arrives from the correct side, snappy (200ms), crisp settle — no mush.
  - Open a conversation from /messages and go back: the page does NOT rise/fade either way; only the content changes.
  - Rapid-fire tab hopping (4 taps/second): no visible flash pile-up — at 200ms the restarts should read as crisp cuts, not stutter.
  - Open `/e/<slug>` from home: short slide-right still present (spatial descend).
  - Reduced motion ON: navigation fades only, no translate.
- **Done when**: same-tab sub-navigation is motionless, cross-tab slides run 200ms/12px on the house curve, reduced-motion fades only, build passes.
