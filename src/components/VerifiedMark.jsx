import { BadgeCheck } from 'lucide-react'

/* =========================================================================
   VerifiedMark — the "in the network" check, in ONE place.

   TEMPORARY, FOR THE V11 PREVIEW ROUND: it ships two skins so Diego can
   compare them on the actual iPhone and pick one. When he picks, the loser
   and the whole switch below get deleted and this collapses to a constant.

     bone  (default) — Cosmos-native: the check IS the bone/star grey, lit by
                       its own glow. Monochrome by discipline.
     blue            — the iconic verified blue, with a matched glow. This
                       BREAKS the Cosmos rule ("no color accents") on purpose,
                       to see whether the instant social legibility of the
                       blue check is worth the exception.

   How to compare on the phone — same page, two links:
     …/community              → bone
     …/community?vmark=blue   → blue

   The parameter is read ONCE at module load and then held for the session,
   so tapping around the app keeps whichever skin was opened. It is cosmetic
   only: it selects a colour and touches nothing about who is verified, which
   is a server fact (the `verified` column, trigger-protected).
   ========================================================================= */

const SKINS = {
  bone: {
    color: '#E8E9ED',                                   // STAR
    glow: 'drop-shadow(0 0 7px rgba(232,233,237,.55))',
  },
  blue: {
    color: '#1D9BF0',
    glow: 'drop-shadow(0 0 7px rgba(29,155,240,.60))',
  },
}

export const VMARK = (() => {
  if (typeof window === 'undefined') return 'bone'
  try {
    const v = new URLSearchParams(window.location.search).get('vmark')
    return v === 'blue' ? 'blue' : 'bone'
  } catch { return 'bone' }
})()

const SKIN = SKINS[VMARK]

/* One mark, one glow, every surface. `style` merges last so a caller can add
   layout (flexShrink, margins) without having to restate the skin. */
export default function VerifiedMark({ size = 16, style }) {
  return (
    <BadgeCheck
      size={size}
      aria-hidden="true"
      style={{ color: SKIN.color, filter: SKIN.glow, ...style }}
    />
  )
}
