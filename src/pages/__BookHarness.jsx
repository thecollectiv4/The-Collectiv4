import { useState } from 'react'
import BookService from '@/pages/BookService'
import Booked from '@/pages/Booked'
import { FONT_MONO } from '@/lib/cosmos'

/* =========================================================================
   DEV-ONLY harness (/__book) — the booking payment page and the post-pay
   ceremony rendered with a STATIC MOCK, so both can be design-QA'd on a
   real phone without a real listing or a real payment. House pattern
   (see /__os-harness, /__motion, /__create in App.jsx): lazy + DEV-gated
   const, statically excluded from prod builds. The mock never touches
   the DB and is labeled here, not disguised as data.
   ========================================================================= */

const MOCK_SERVICE = {
  listing: {
    id: '00000000-0000-0000-0000-000000000000',
    kind: 'service',
    title: 'Event photography · full set',
    description: 'Full-night coverage — the room, the booth, the people. Edited set, ready for feed and press.',
    price_cents: 15000,
    currency: 'usd',
    status: 'live',
    delivery: '60 edited photos · 5 days',
    images: [],
  },
  creative: {
    id: '00000000-0000-0000-0000-000000000001',
    full_name: 'Harness Preview',
    username: 'harness',
    avatar_url: '',
    bio: 'Mock creative for layout QA — not a real profile, never rendered outside DEV.',
    city: 'Houston',
    verified: false,
    is_demo: true,
  },
}

const MOCK_BOOKING = {
  status: 'paid',
  service_title: MOCK_SERVICE.listing.title,
  price_cents: MOCK_SERVICE.listing.price_cents,
  currency: 'usd',
  client_name: 'Harness Client',
  creative_name: MOCK_SERVICE.creative.full_name,
}

export default function BookHarness() {
  const [view, setView] = useState('book')
  return (
    <>
      <div style={{ position: 'fixed', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 20000, display: 'flex', gap: '8px' }}>
        {['book', 'booked'].map((v) => (
          <button key={v} onClick={() => setView(v)}
            style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: '100px', cursor: 'pointer', background: view === v ? 'var(--cream)' : 'rgba(var(--ink-rgb),.08)', color: view === v ? 'var(--bg)' : 'var(--cream-mid)', border: '1px solid rgba(var(--ink-rgb),.2)' }}>
            {v}
          </button>
        ))}
      </div>
      {view === 'book' ? <BookService preview={MOCK_SERVICE} /> : <Booked preview={MOCK_BOOKING} />}
    </>
  )
}
