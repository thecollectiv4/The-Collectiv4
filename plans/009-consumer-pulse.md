# 009 — The consumer surfaces breathe: messages arrive, segments connect, the sky of worlds surfaces

- **Status**: DONE
- **Commit**: 2e47930
- **Severity**: MEDIUM
- **Category**: Missed opportunities + Cohesion
- **Estimated scope**: 4 files (Messages.jsx, Community.jsx, Events.jsx, index.css), ~40 lines

Depends on: plan 001 (tokens) and plan 004 (defines `msgIn`/`.msg-in` — if 004 hasn't run, add that keyframe/class from 004 verbatim first).

## Problem

The team instrument (/os) animates better than the member-facing surfaces — inverted priorities:

**A. Chat messages teleport in** — including live-arriving ones mid-read (src/pages/Messages.jsx:959-963 appends via `subscribeThread`); the render is bare divs:

```jsx
/* src/pages/Messages.jsx:1076-1080 — current */
{msgs.map((m) => {
  const mine = m.sender_id === me.id
  ...
  return (
    <div key={m.id} style={{ display: 'flex', gap: '10px', flexDirection: mine ? 'row-reverse' : 'row' }}>
```

**B. Inbox segment swaps hard-cut** — SIGNALS/CREWS/PLANS are conditional blocks with no transition (src/pages/Messages.jsx:276, 299, ~332: `{seg === 'signals' && (...)}` etc.), while /os panes slide directionally.

**C. Discovery loading→loaded pops; refiltering snaps** — spinner cuts to a full grid at once; changing city/craft/search snaps a different card set into place:

```jsx
/* src/pages/Community.jsx:261-269 — current */
{loading || (craft !== 'all' && !craftsLoaded) ? (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
    <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
  </div>
) : shown.length > 0 ? (
  <div style={{ display: 'grid', gridTemplateColumns: ..., gap: ... }}>
    {shown.map(c => (<WorldCard key={c.id} ... />))}
```

Same pattern at src/pages/Events.jsx:145-170 (spinner → FeaturedRoom + RoomCard list).

## Target

**A — only truly new messages animate** (the `prevLen` ref pattern from plan 004; history load and thread-open never animate):

```jsx
/* target — Messages.jsx thread view: near the msgs state */
const prevLen = useRef(msgs.length)          // init to current: opening a thread animates nothing
useEffect(() => { prevLen.current = msgs.length }, [msgs.length])
/* in the map */
<div key={m.id} className={idx >= prevLen.current ? 'msg-in' : ''} style={{ ... }}>
```

(Add `idx` as the map's second arg. `.msg-in` = 4px rise + fade, 200ms house curve — defined in plan 004.)

**B — segments get the directional grammar at consumer register.** Track the previous segment index (`['signals','crews','plans']`), wrap the segment content in a keyed div, reuse the retimed `.os-slide-in-*` classes (10px/200ms after plan 004 — they are not os-scoped selectors, just class names):

```jsx
/* target — Messages.jsx inbox: near the seg state */
const SEGS = ['signals', 'crews', 'plans']
const prevSeg = useRef(seg)
const segDir = SEGS.indexOf(seg) > SEGS.indexOf(prevSeg.current) ? 'os-slide-in-right' : SEGS.indexOf(seg) < SEGS.indexOf(prevSeg.current) ? 'os-slide-in-left' : ''
useEffect(() => { prevSeg.current = seg }, [seg])
/* wrap the three conditional segment blocks in ONE keyed container */
<div key={seg} className={segDir}>
  {seg === 'signals' && ( ... )}
  {seg === 'crews' && ( ... )}
  {seg === 'plans' && ( ... )}
</div>
```

**C — first load staggers once; refilter crossfades under a 2px blur mask** (no per-card motion on refilter — too frequent):

```css
/* target — src/index.css */
/* discovery cards surface once — first load only, capped stagger */
.card-in { opacity:0; animation: fadeUp var(--dur-slow) var(--ease-house) forwards; }
/* a refiltered grid crossfades as one — blur masks the double-exposure */
@keyframes refilterIn { from { opacity:.4; filter:blur(2px); } to { opacity:1; filter:blur(0); } }
.refilter-in { animation: refilterIn var(--dur-fast) var(--ease-house); }
```

Reduced-motion block: `.card-in { animation: fadeIn .3s ease forwards; } .refilter-in { animation: none; }`

```jsx
/* target — Community.jsx grid */
const entered = useRef(false)                 // first data landing animates; refilters don't
useEffect(() => { if (!loading) entered.current = true }, [loading])
const filterKey = `${city}|${craft}|${q}`     // ← use the component's actual filter state names
...
<div key={entered.current ? filterKey : 'first'} className={entered.current ? 'refilter-in' : undefined}
     style={{ display: 'grid', ... }}>
  {shown.map((c, i) => (
    <div key={c.id} className={entered.current ? undefined : 'card-in'}
         style={entered.current ? undefined : { animationDelay: `${Math.min(i, 8) * 50}ms` }}>
      <WorldCard c={c} ... />
    </div>
  ))}
</div>
```

(50ms steps inside the 30–80ms window, capped at 8 — beyond that, cards land together. `WorldCard` gets a plain wrapper div; do not modify WorldCard itself.)

Events.jsx: same `.card-in` treatment on first load for `FeaturedRoom` (delay 0) and each `RoomCard` (`Math.min(i,8)*50 + 100`ms); Events has no refilter UI — skip the crossfade there.

## Repo conventions to follow

- `fadeUp`/`fadeIn` keyframes already exist (index.css:72-73) — reuse, don't redefine.
- `forwards` on `.card-in` follows the accepted `.os-reveal` pattern (delayed opacity:0 start); grid cards contain no `position:fixed` descendants (verified — WorldCard is a plain card).
- Ref-init-to-current for "never animate what was already there" is the same pattern as plan 004's Brain fix.

## Steps

1. src/index.css — add `.card-in`, `refilterIn`/`.refilter-in`, reduced-motion lines.
2. src/pages/Messages.jsx — thread view: `prevLen` ref + `.msg-in` gating (A). Inbox: `SEGS`/`prevSeg`/keyed wrapper (B). Verify the three segment blocks are siblings before wrapping (lines ~276-340).
3. src/pages/Community.jsx — `entered` ref, keyed grid, `.card-in` staggered wrappers, `.refilter-in` on filter changes (C). Use the component's real filter-state variable names for `filterKey` (read them at the top of the component — `city`/`craft`/search state).
4. src/pages/Events.jsx — `.card-in` on first load only (same `entered` ref pattern).

## Boundaries

- Do NOT touch data fetching, subscriptions, `markThreadRead`, filters' logic, or empty states.
- No per-card animation on refilter; no animation on segment content while `segDir` is '' (initial mount).
- No new dependencies.
- If a cited line doesn't match (drift since 2e47930), STOP on that file and report; finish the others.

## Verification

- **Mechanical**: `npm run build` passes.
- **Feel check**:
  - Open a conversation: history renders instantly, nothing animates. Have the other account send a message (or send one yourself): only that bubble rises 4px.
  - Inbox: SIGNALS→CREWS slides left-to-right; CREWS→SIGNALS reverses; direction matches the segment order.
  - /community first load: cards surface in a 50ms cascade (≤8 steps). Change craft filter: one soft 200ms blur-crossfade of the whole grid, no per-card dance, no double-exposure at 10% speed.
  - /events first load: featured room then cards cascade once; revisits within the session don't replay (state persists per mount — remounting the route replays, which is acceptable: it matches the page-transition remount).
  - Reduced motion ON: fades only, no slides/rises/blur.
- **Done when**: new-message-only entrances, directional segments, once-only discovery cascade + masked refilter, build passes.
