/* =========================================================================
   VerifiedMark — the "in the network" check.

   Diego picked BLUE, deliberately, and it is now the one and only skin: the
   preview switch and the bone variant are gone. This is the ONE sanctioned
   break in the Cosmos monochrome rule — the verified badge is a social
   primitive people read at a glance, and legibility beat the palette here.

   It is SOLID, the way Instagram and X draw it: the scalloped seal is a
   FILLED shape and the check is knocked out of it in white — not an outline
   with a tick inside. The outline version read as a sticker; the filled one
   reads as a badge.

   It is display only. Who is verified is a server fact (the `verified`
   column, trigger-protected against self-granting) — nothing here decides it.
   ========================================================================= */

const BLUE = '#1D9BF0'
const GLOW = 'drop-shadow(0 0 7px rgba(29,155,240,.55))'

/* The seal. Twelve lobes, drawn as four overlapping rounded quarters — the
   same silhouette lucide uses for badge-check, but filled instead of
   stroked, which is the whole difference between a badge and a sticker. */
const SEAL = 'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z'

export default function VerifiedMark({ size = 16, style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      aria-hidden="true" focusable="false"
      style={{ filter: GLOW, display: 'block', flexShrink: 0, ...style }}
    >
      <path d={SEAL} fill={BLUE} />
      {/* the check, knocked out. strokeWidth scales a touch at small sizes so
          it never thins into invisibility on a 14px badge. */}
      <path
        d="m9 12 2 2 4-4"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={size <= 15 ? 2.6 : 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
