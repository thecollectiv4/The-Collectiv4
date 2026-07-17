# 010 — Press feedback: asymmetric timing, settle on release, coverage gaps

- **Status**: DONE
- **Commit**: 2e47930
- **Severity**: LOW
- **Category**: Physicality & origin + Interruptibility
- **Estimated scope**: 3 files (index.css, AuthModal.jsx, WorldBuilder.jsx), ~10 line-sites

Depends on: plan 001 (tokens).

## Problem

```css
/* src/index.css:108-109 — current: press and release share one symmetric .16s */
.pressable { transition: transform .16s ease, opacity .16s ease; }
.pressable:not(:disabled):active { transform: translateY(1px) scale(.99); }
```

Symmetric press-and-release timing is a finding: the deliberate phase (press) may take its time; the system's response (release) should snap.

```css
/* src/index.css:172-174 — current: transform missing from the OS button transition list */
.os-root button { transition: color .15s ease, background .15s ease, border-color .15s ease, opacity .15s ease, filter .15s ease; }
.os-root button:not(:disabled):active { transform: translateY(1px) }
```

The OS-wide press feedback snaps instantly in both directions (no transform transition at all). *(If plan 008 already added `transform .16s var(--ease-exit)` to the Btn primitive's inline list, this CSS rule still governs every non-Btn OS button.)*

Coverage gaps — pressables with neither press feedback nor a transform-collision reason (verified: no inline hover transforms on these):
- src/components/AuthModal.jsx:73 (Sign In / Create Account toggle), :59 (close ✕), :99 (forgot password)
- src/components/WorldBuilder.jsx footer + controls: Next/Back/Skip/Publish and theme tiles (~lines 447, 467, 623, 647, 675, 684 — verify each is a `<button>` without inline transform handlers before adding)

## Target

```css
/* target — src/index.css:108-109: press deliberate (160ms), release snaps (80ms) */
.pressable { transition: transform 80ms var(--ease-exit), opacity 80ms var(--ease-exit); }
.pressable:not(:disabled):active {
  transform: translateY(1px) scale(.99);
  transition: transform var(--dur-press) var(--ease-exit), opacity var(--dur-press) var(--ease-exit);
}
```

(The `:active` rule's transition governs entering the pressed state — 160ms; the base rule governs release — 80ms.)

```css
/* target — src/index.css:172: add transform to the list */
.os-root button { transition: color .15s ease, background .15s ease, border-color .15s ease, opacity .15s ease, filter .15s ease, transform 80ms var(--ease-exit); }
.os-root button:not(:disabled):active { transform: translateY(1px); transition: transform var(--dur-press) var(--ease-exit); }
```

JSX: add `className="pressable"` to the AuthModal and WorldBuilder elements listed above (merge with existing className strings where present).

## Repo conventions to follow

- `.pressable` is opt-in by design (documented at index.css:103-107, "never a toy bounce") — respect that: only the listed, verified-collision-free elements gain it.
- The reduced-motion block (index.css:256-257) already neutralizes `.pressable:active` and `.os-root button:active` transforms — no change needed there.

## Steps

1. src/index.css — asymmetric split on `.pressable` (108-109) and the `.os-root button` rules (172-174) per Target.
2. src/components/AuthModal.jsx — add `pressable` to the three elements (59, 73, 99), checking none carries an inline transform.
3. src/components/WorldBuilder.jsx — add `pressable` to the footer buttons and theme tiles at the listed lines, same check per element.

## Boundaries

- Do NOT add `.pressable` anywhere else (elements with inline `onMouseOver` transforms — e.g. AuthModal.jsx:103-105's submit — are exempt by design).
- Do NOT change the transform values (translateY(1px) scale(.99) is the house settle).
- If a listed element already has press feedback or carries a transform handler, skip it and note it.

## Verification

- **Mechanical**: `npm run build` passes.
- **Feel check**: press-and-hold any `.pressable` (CREATE door, Done CTA): it eases down over ~160ms; release: it returns almost instantly (~80ms). In /os, click a Btn — release now settles instead of popping. AuthModal toggle and WorldBuilder Next visibly settle on press.
- Reduced motion ON: no transforms (existing block covers it).
- **Done when**: press ≈160ms in / ≈80ms out everywhere `.pressable` applies, OS buttons transition transform, the listed gaps are covered, build passes.
