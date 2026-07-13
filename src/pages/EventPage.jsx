import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/api/supabase'
import { shapeEvent } from '@/lib/useLiveEvent'
import { EventShow } from '@/pages/EventLanding'

/* =========================================================================
   /e/:slug — a public room for ANY published event, the same editorial
   spread as the root landing (EventShow). This is where a verified
   member's event lives: Discover links here, the checkout posts the same
   eventSlug the function already validates server-side — zero changes to
   the purchase flow. Drafts stay invisible (events RLS hides them) and
   the hidden QA event never surfaces (is_test).
   ========================================================================= */

export default function EventPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, row: null })

  useEffect(() => {
    let alive = true
    setState({ loading: true, row: null })
    // PUBLISHED only: a 'past' event must never wear a live buy button on a
    // shareable URL — the checkout function refuses drafts but not archives,
    // so the honest room simply doesn't open for them (Leyes 9, 11).
    supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .eq('is_test', false)
      .eq('status', 'published')
      .maybeSingle()
      .then(({ data }) => { if (alive) setState({ loading: false, row: data || null }) })
      .catch(() => { if (alive) setState({ loading: false, row: null }) })
    return () => { alive = false }
  }, [slug])

  if (state.loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={22} style={{ color: 'var(--cream-low)', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (!state.row) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center', background: 'var(--bg)' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: 'var(--cream)', letterSpacing: '.02em', marginBottom: '8px' }}>THIS ROOM ISN'T OPEN</div>
        <div style={{ fontSize: '13px', color: 'var(--cream-low)', lineHeight: 1.6, marginBottom: '20px' }}>No published event lives at this address.</div>
        <button className="pressable" onClick={() => navigate('/discover')}
          style={{ background: 'rgba(242,238,230,.06)', border: '1px solid rgba(242,238,230,.18)', borderRadius: '100px', padding: '10px 20px', color: 'var(--cream-mid)', fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
          ← Discover
        </button>
      </div>
    )
  }

  return <EventShow live={shapeEvent(state.row, false)} />
}
