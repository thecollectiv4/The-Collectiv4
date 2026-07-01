// ⚠️ TEMP — design showcase for PR review only. DELETE BEFORE MERGE.
// Lets the filled ProfileMuseum world be seen live on the Vercel preview at
// /__museum-preview (no auth, no data needed). Remove this file + its route in App.jsx.
import { useState } from 'react'
import ProfileMuseum from '@/components/ProfileMuseum'

const FULL = {
  id: 'demo-pato',
  full_name: 'PATO DURÁN',
  username: 'patoduranc',
  discipline: 'DJ · Founder · Creative Director',
  city: 'Houston, TX',
  tagline: 'Chasing the sound that doesn’t exist yet.',
  bio: 'House and techno out of Houston. Founder of The Collectiv4 — building the room where a scattered creative city feels like one. When I play, I play for the room, not the clip.',
  verified: true,
  cover_url: 'https://picsum.photos/seed/c4cover9/1200/720.jpg',
  avatar_url: 'https://picsum.photos/seed/patoav/400/400.jpg',
  taste: {
    music: [
      'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      'Fred again..',
      'Nicolás Jaar',
      'Fela Kuti',
      'Four Tet',
      'https://www.youtube.com/watch?v=kXYiU_JCYtU',
    ],
    films: [
      'In the Mood for Love',
      'Paris, Texas',
      'Suspiria',
      'https://picsum.photos/seed/poster1/400/600.jpg',
      'Enter the Void',
      'https://www.youtube.com/watch?v=kXYiU_JCYtU',
    ],
    influences: ['Virgil Abloh', 'Bauhaus', 'Carl Jung', 'Houston', 'Marcus Aurelius', 'Boiler Room', 'Tesla'],
  },
  media: [
    { type: 'embed', url: 'https://www.youtube.com/watch?v=kXYiU_JCYtU', title: 'RBA Edition 002 — Closing Set' },
    { type: 'image', url: 'https://picsum.photos/seed/c4work/900/650.jpg', title: 'Live at Sanman Studios' },
    { type: 'link', url: 'https://www.instagram.com/patoduranc', title: 'Instagram' },
  ],
}

// a near-empty world — so the "presence when empty" invitations can be QA'd too
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
