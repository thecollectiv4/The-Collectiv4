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

/* WELL — the resting version of a BUBBLE, not a flat box. The first pass
   made this so faint (0.05 fill, 0.10 border, one weak inset) that it read as
   a drawn rectangle instead of a piece of glass, which is exactly the note
   that came back from the phone.

   The fix is not more opacity — it is keeping all THREE depth cues BUBBLE
   has and only lowering their level: a specular top edge, a dark inner floor
   under it, and a cast shadow beneath. Drop any one of them and the volume
   collapses no matter how bright the fill is. */
export const WELL = {
  background: 'linear-gradient(180deg, rgba(242,238,230,0.14), rgba(242,238,230,0.035) 55%, rgba(10,10,13,0.10))',
  border: '1px solid rgba(242,238,230,0.24)',
  boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.30), inset 0 -5px 9px -5px rgba(0,0,0,0.50), 0 3px 10px rgba(0,0,0,0.32)',
}

/* The bone glow, one value, so every lit mark in the app agrees. */
export const BONE_GLOW = 'drop-shadow(0 0 7px rgba(242,238,230,.55))'

/* ── CARDS ───────────────────────────────────────────────────────────────
   Cards used to be a flat opaque #0E0E13, which meant any "glass" chip drawn
   on one was glass over a wall — the blur had nothing live to sample. They
   are translucent now, so the app's own atmosphere (the star field, whatever
   scrolls past) genuinely reads through them.

   TWO DELIBERATE LIMITS:

   · The blur is 14px, not the bar's 28. A view shows ONE bar but a DOZEN
     cards, and backdrop-filter re-rasterizes per element per frame — the
     kernel runs in device pixels, so 28px on a 3x phone is an 84px kernel,
     twelve times over, every scroll frame. And the backdrop here is a dark,
     nearly featureless sky: past ~14px the extra radius buys almost no
     visible difference and a lot of GPU. Translucency is what sells this
     effect, not blur radius.
   · The fill still carries real weight (0.72-0.80 alpha). Text legibility on
     a card is not negotiable, and a card you can read the stars through is a
     card you cannot read the name on.

   CARD_TINT is the plain translucent fill for surfaces that should show the
   sky but do not warrant their own compositor layer (nested rows, inner
   panels). Reach for cardGlass only on the outer card. */
export const CARD_TINT = 'rgba(14,14,19,0.76)'

const CARD_FILTER = 'saturate(150%) brightness(1.06) blur(14px)'

export const cardGlass = (extra = {}) => ({
  background: 'linear-gradient(180deg, rgba(20,20,26,0.74) 0%, rgba(12,12,17,0.82) 100%)',
  WebkitBackdropFilter: CARD_FILTER,
  backdropFilter: CARD_FILTER,
  boxShadow: 'inset 0 1px 0 rgba(242,238,230,0.10), inset 0 -1px 0 rgba(7,8,14,0.55), 0 10px 30px rgba(0,0,0,0.42)',
  ...extra,
})
