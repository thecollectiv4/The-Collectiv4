// ⚠️ TEMP — design showcase for PR review only. DELETE BEFORE MERGE.
// Lets the filled ProfileMuseum world be seen live on the Vercel preview at
// /__museum-preview (no auth, no data needed). Remove this file + its route in App.jsx.
import ProfileMuseum from '@/components/ProfileMuseum'

const MOCK = {
  id: 'demo-pato',
  full_name: 'PATO DURÁN',
  username: 'patoduranc',
  discipline: 'DJ · Founder · Creative Director',
  city: 'Houston, TX',
  tagline: 'Chasing the sound that doesn’t exist yet.',
  bio: 'House and techno out of Houston. Founder of The Collectiv4 — building the room where a scattered creative city feels like one. When I play, I play for the room, not the clip.',
  verified: true,
  cover_url: 'https://picsum.photos/seed/c4cover/1200/520.jpg',
  avatar_url: 'https://picsum.photos/seed/patoav/400/400.jpg',
  taste: {
    music: [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'Fred again..',
      'Nicolás Jaar',
      'Fela Kuti',
      'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
    ],
    films: ['In the Mood for Love', 'Paris, Texas', 'Suspiria', 'https://www.youtube.com/watch?v=kXYiU_JCYtU'],
    influences: ['Virgil Abloh', 'Bauhaus', 'Carl Jung', 'Houston'],
  },
  media: [
    { type: 'embed', url: 'https://www.youtube.com/watch?v=kXYiU_JCYtU', title: 'RBA Edition 002 — Closing Set' },
    { type: 'image', url: 'https://picsum.photos/seed/c4work/900/650.jpg', title: 'Live at Sanman Studios' },
    { type: 'link', url: 'https://www.instagram.com/patoduranc', title: 'Instagram' },
  ],
}
const EVENT = { name: 'RAN BY ARTISTS', editionNumber: '002', dateLong: 'June 13, 2026', city: 'Houston' }

export default function MuseumShowcase() {
  return <ProfileMuseum profile={MOCK} isOwner={false} ticket={true} event={EVENT} topBar={<><span /><span /></>} />
}
