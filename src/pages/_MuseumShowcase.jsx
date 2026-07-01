// ⚠️ TEMP — design showcase for PR review only. DELETE BEFORE MERGE.
// Lets the filled ProfileMuseum world be seen live on the Vercel preview at
// /__museum-preview (no auth, no data needed). Remove this file + its route in App.jsx.
import { useState } from 'react'
import ProfileMuseum from '@/components/ProfileMuseum'

// An on-brand demo cover generated inline (no external, always dark): cosmic
// void + star field + a chrome orbit/ringed-body motif. Reads "star chart",
// never a stock photo. Deterministic (seeded LCG, no Math.random).
function cosmicCover() {
  let s = 1337
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const stars = Array.from({ length: 90 }, () =>
    `<circle cx="${(rnd() * 1200) | 0}" cy="${(rnd() * 760) | 0}" r="${(rnd() * 1.5 + 0.3).toFixed(1)}" fill="#E8E9ED" opacity="${(rnd() * 0.7 + 0.12).toFixed(2)}"/>`
  ).join('')
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='760'>
    <defs>
      <radialGradient id='v' cx='50%' cy='16%' r='95%'>
        <stop offset='0%' stop-color='#16171D'/><stop offset='42%' stop-color='#0B0B11'/><stop offset='100%' stop-color='#07080E'/>
      </radialGradient>
      <linearGradient id='c' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#EEF0F4'/><stop offset='50%' stop-color='#83868F'/><stop offset='100%' stop-color='#CED1DA'/>
      </linearGradient>
    </defs>
    <rect width='1200' height='760' fill='url(#v)'/>
    ${stars}
    <g transform='translate(852 236)'>
      <ellipse rx='300' ry='300' fill='none' stroke='url(#c)' stroke-width='1.1' opacity='0.45'/>
      <ellipse rx='320' ry='88' fill='none' stroke='url(#c)' stroke-width='1' opacity='0.32'/>
      <circle r='58' fill='#0C0D13' stroke='url(#c)' stroke-width='1.4' opacity='0.85'/>
      <circle r='58' fill='none' stroke='#E8E9ED' stroke-width='0.5' opacity='0.25'/>
    </g>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const FULL = {
  id: 'demo-pato',
  full_name: 'PATO DURÁN',
  username: 'patoduranc',
  discipline: 'DJ · Founder · Creative Director',
  city: 'Houston, TX',
  tagline: 'Chasing the sound that doesn’t exist yet.',
  bio: 'House and techno out of Houston. Founder of The Collectiv4 — building the room where a scattered creative city feels like one. When I play, I play for the room, not the clip.',
  verified: true,
  cover_url: cosmicCover(),
  // no avatar → shows the on-brand chrome monogram medallion (kept off a random
  // stock photo so QA stays in-universe; the real avatar-image path is unchanged)
  avatar_url: '',
  taste: {
    music: [
      'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      'Nicolás Jaar',
      'Four Tet',
      'Floating Points',
      'Fred again..',
      'Ricardo Villalobos',
    ],
    films: [
      'Enter the Void',
      'Blade Runner 2049',
      'Under the Skin',
      '2001: A Space Odyssey',
      'Suspiria',
      'Uncut Gems',
    ],
    influences: ['Virgil Abloh', 'Boiler Room', 'Kraftwerk', 'Carl Jung', 'Bauhaus', 'Warhol', 'Houston', 'Marcus Aurelius'],
  },
  media: [
    { type: 'embed', url: 'https://www.youtube.com/watch?v=kXYiU_JCYtU', title: 'RBA Edition 002 — Closing Set' },
    { type: 'link', url: 'https://www.instagram.com/patoduranc', title: 'Instagram' },
  ],
}

// a near-empty world — so the "presence when empty" (cosmic field + invites) can be QA'd
const SPARSE = {
  id: 'demo-empty',
  full_name: 'NEW ARTIST',
  username: 'newartist',
  discipline: 'Photographer',
  city: 'Houston, TX',
  verified: false,
  taste: { music: [], films: [], influences: [] },
  media: [],
}

const EVENT = { name: 'RAN BY ARTISTS', editionNumber: '002', dateLong: 'June 13, 2026', city: 'Houston' }

export default function MuseumShowcase() {
  // ?empty and ?owner let the founder QA every state from the preview URL
  const params = new URLSearchParams(window.location.search)
  const [profile] = useState(params.has('empty') ? SPARSE : FULL)
  const isOwner = params.has('owner')
  return (
    <ProfileMuseum
      profile={profile}
      isOwner={isOwner}
      onSave={async () => {}}
      onUploadAvatar={async () => null}
      onUploadCover={async () => null}
      ticket={!isOwner}
      event={EVENT}
      topBar={<><span /><span /></>}
    />
  )
}
