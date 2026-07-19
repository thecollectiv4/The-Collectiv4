/* =========================================================================
   THE GLASS RECIPE — one source for every liquid-glass surface (v11).

   These lived hand-rolled inside GlassNav.jsx while the desktop header wore
   a flat pill, so the two drifted: the same CREATE button was a lit bubble
   on a phone and a dead outline on a laptop. One module now, both callers.

   RULES BAKED IN HERE, learned the hard way on real WebKit:

   · LITERAL VALUES ONLY inside backdrop-filter. WebKit silently drops the
     whole declaration if any part of the chain resolves from a CSS custom
     property (bug 289800) — and DevTools still shows it as applied.
   · COLOUR OPS BEFORE BLUR. saturate/contrast/brightness must act on
     unblurred pixels; putting blur first flattens the chroma it needs.
   · NEVER NEST GLASS. An element with backdrop-filter is itself a backdrop
     root, so glass inside glass re-blurs the parent's output instead of the
     page — a muddy grey patch. Inner panes get GRADIENTS, never a second
     blur. That is what CHIP and BUBBLE below are.
   · THE EDGE CARRIES THE DEPTH, not the blur radius. A lit top facet over a
     dark inner floor is what the eye reads as thickness; past ~28px the blur
     only buys GPU cost (the kernel runs in DEVICE pixels — 28 CSS px is an
     84px kernel on a 3x iPhone).
   ========================================================================= */

/* The full material — only for surfaces that genuinely have live page behind
   them (the floating bar, chrome over the atmosphere). Both properties must
   be emitted; Safari 17.6 and older only know the prefixed one. */
export const GLASS_FILTER = 'saturate(180%) contrast(0.92) brightness(1.08) blur(28px)'

export const glassSurface = (extra = {}) => ({
  WebkitBackdropFilter: GLASS_FILTER,
  backdropFilter: GLASS_FILTER,
  background: 'linear-gradient(180deg, rgba(30,31,40,0.42) 0%, rgba(12,12,17,0.56) 100%)',
  border: '1px solid rgba(242,238,230,0.12)',
  boxShadow: [
    '0 26px 54px rgba(0,0,0,0.60)',
    '0 8px 20px rgba(0,0,0,0.45)',
    'inset 0 1.5px 0 rgba(242,238,230,0.22)',
    'inset 0 -1px 0 rgba(7,8,14,0.55)',
    'inset 0 26px 36px -26px rgba(242,238,230,0.22)',
  ].join(', '),
  ...extra,
})

/* CHIP — the pane of brighter glass that marks the active thing. Gradient
   only (see the no-nesting rule). Reads as a lit facet resting ON the slab. */
export const CHIP = {
  background: 'linear-gradient(180deg, rgba(242,238,230,0.24), rgba(242,238,230,0.09), rgba(10,10,13,0.12))',
  border: '1px solid rgba(242,238,230,0.26)',
  boxShadow: 'inset 0 1.5px 1px rgba(255,255,255,0.50), inset 0 -6px 10px -4px rgba(0,0,0,0.5), 0 6px 16px rgba(0,0,0,0.38)',
}

/* BUBBLE — the CREATE treatment: brighter fill, a thin BONE ring, a specular
   top edge. This is what makes an icon read as a physical control instead of
   a glyph on a flat plane. */
export const BUBBLE = {
  background: 'linear-gradient(180deg, rgba(242,238,230,0.22), rgba(242,238,230,0.07))',
  border: '1px solid rgba(242,238,230,0.58)',
  boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.45), 0 4px 12px rgba(0,0,0,0.35)',
}

/* WELL — the quiet version for an INACTIVE icon box. Barely there: enough
   inner light to stop it reading as a hole, never enough to compete with the
   lit one. Museum, not circus. */
export const WELL = {
  background: 'linear-gradient(180deg, rgba(242,238,230,0.05), rgba(242,238,230,0.015))',
  border: '1px solid rgba(242,238,230,0.10)',
  boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.10)',
}

/* The bone glow, one value, so every lit mark in the app agrees. */
export const BONE_GLOW = 'drop-shadow(0 0 7px rgba(242,238,230,.55))'
