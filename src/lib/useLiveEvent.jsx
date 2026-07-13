import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/api/supabase'

/* =========================================================================
   useLiveEvent — the single source of truth for "the live event".

   ONE published row in public.events is the upcoming event. We read it once,
   here, and every surface (landing, profile badge, ticket card, community
   header, door scanner…) derives its name/edition/date/city from this — never
   from a hardcoded string. The moment the fall event locks (a new row flips to
   status='published'), every screen updates at once.

   RLS-safe: events_public_read exposes every non-draft row to the anon key, so
   this select is fine client-side. The seeded Edition 002 row is status='past'
   on purpose, so it does NOT surface here — when nothing is published yet we
   fall back to a name-only placeholder (a TBA date), never a stale wrong date.
   ========================================================================= */

// Brand defaults used when no event is published yet. NAME only — city, dates
// and doors stay empty so placeholders stay honest ("Date TBA", no city line)
// instead of asserting facts about an event that doesn't exist.
const FALLBACK = {
  id: null, slug: null,
  title: 'RAN BY ARTISTS', edition: '',
  city: '', venue: '', doors: '', event_date: null,
}

function fmt(date, opts) {
  try { return new Date(date).toLocaleDateString('en-US', opts) } catch { return '' }
}

// Normalize a raw events row (or the fallback) into the display-ready object
// every consumer reads. Keeps all date formatting in one place. Exported as
// shapeEvent so /e/:slug can dress ANY published event in the same object
// the landing already renders — one composition, many rooms.
export function shapeEvent(row, loading) { return shape(row, loading) }
function shape(row, loading) {
  const e = row || FALLBACK
  const date = e.event_date ? new Date(e.event_date) : null
  return {
    loading,
    raw: row || null,                                   // full row for EventLanding (tiers/lineup/etc.)
    id: e.id || null,
    slug: e.slug || null,
    name: e.title || FALLBACK.title,                    // "RAN BY ARTISTS"
    edition: e.edition || '',                           // "EDITION 002" (already upper in DB)
    editionNumber: (e.edition || '').match(/\d+/)?.[0] || '', // "002"
    city: e.city || '',                                 // real city or nothing — consumers guard
    venue: e.venue || '',
    doors: e.doors || '',
    date,
    hasDate: !!date,
    dateLong:  date ? fmt(date, { month: 'long',  day: 'numeric', year: 'numeric' }) : 'Date TBA', // June 13, 2026
    dateMed:   date ? fmt(date, { month: 'long',  day: 'numeric' })                  : 'TBA',       // June 13
    dateShort: date ? fmt(date, { month: 'short', day: 'numeric' })                  : 'soon',      // Jun 13
  }
}

const LiveEventContext = createContext(shape(null, true))

export function LiveEventProvider({ children }) {
  const [state, setState] = useState(() => shape(null, true))

  useEffect(() => {
    let alive = true
    // THE live event is a HOUSE event (is_house, migration 0016) — a member
    // publishing THEIR event must never hijack the root landing. Pre-0016
    // (column not deployed yet) the filtered query errors → fall back to the
    // old shape so the landing keeps working while the migration lands.
    const base = () => supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .eq('is_test', false)   // never surface the hidden QA event (migration 0012)
      .order('created_at', { ascending: false })
      .limit(1)
    base().eq('is_house', true)
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          // ONLY the missing-column error (42703, pre-0016) may widen the
          // query — a transient failure must never let a member's event
          // wear the house landing for a frame
          if (error.code === '42703') {
            base().then(({ data: d2 }) => { if (alive) setState(shape(d2 && d2[0] ? d2[0] : null, false)) })
              .catch(() => { if (alive) setState(shape(null, false)) })
          } else {
            setState(shape(null, false))
          }
          return
        }
        setState(shape(data && data[0] ? data[0] : null, false))
      })
      .catch(() => { if (alive) setState(shape(null, false)) })
    return () => { alive = false }
  }, [])

  return <LiveEventContext.Provider value={state}>{children}</LiveEventContext.Provider>
}

export function useLiveEvent() {
  return useContext(LiveEventContext)
}
