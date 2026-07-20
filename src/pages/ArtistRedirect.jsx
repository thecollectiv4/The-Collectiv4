import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/api/supabase'
import { foldText } from '@/lib/match'

/* =========================================================================
   /artist/:slug — DEAD as a page (D1, El Mundo v7). Nobody is a folleto.
   The old static ArtistProfile brochure is gone; this route now RESOLVES
   the slug to the person's REAL world and redirects there (a live door),
   or — when no real world exists — lands on a clean "moved" state. It NEVER
   invents a world (Ley 11). Old shared /artist/* links therefore never 404
   and, when the person is real, arrive at their actual /user/:id museum.

   Match (mirror of resolveLineupWorlds, minus the entry's handle which a
   bare URL doesn't carry): username == slug or slug-no-dashes, or full_name
   folds equal to the slug read as words ('pato-duran' → 'pato duran' →
   'Pato Duran'). VERIFIED members only — a self-serve username/name must
   not let anyone squat a headliner's door (the impersonation antibody).
   Purged worlds never resolve (profiles_public_read filters deleted_at).
   ========================================================================= */

const cleanForOr = (s) => /^[^,()"]*$/.test(s)

export default function ArtistRedirect() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, id: null })

  useEffect(() => {
    let alive = true
    setState({ loading: true, id: null })
    const s = (slug || '').trim().toLowerCase()
    if (!s) { setState({ loading: false, id: null }); return () => { alive = false } }

    const noDash = s.replace(/-/g, '')
    const asWords = s.replace(/-/g, ' ')
    const ors = [
      `username.ilike.${s}`,
      noDash !== s ? `username.ilike.${noDash}` : null,
      asWords !== s ? `full_name.ilike.${asWords}` : null,
    ].filter(Boolean).filter((o) => cleanForOr(o.split('.').slice(2).join('.')))

    supabase
      .from('profiles')
      .select('id, username, full_name')
      .or(ors.join(','))
      .eq('is_demo', false)
      .eq('verified', true)
      .limit(10)
      .then(({ data }) => {
        if (!alive) return
        // exact re-validation (mirror of resolveLineupWorlds): the ilike can
        // match LIKE wildcards (_ %), so accept ONLY an exact username or
        // folded-name hit — never redirect to a merely-similar world.
        const hit = (data || []).find((p) => {
          const u = (p.username || '').toLowerCase()
          return u === s || u === noDash || foldText(p.full_name) === foldText(asWords)
        })
        setState({ loading: false, id: hit?.id || null })
      })
      .catch(() => { if (alive) setState({ loading: false, id: null }) })
    return () => { alive = false }
  }, [slug])

  if (state.loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={22} style={{ color: 'var(--cream-low)', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (state.id) return <Navigate to={'/user/' + state.id} replace />

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center', background: 'var(--bg)' }}>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: 'var(--cream)', letterSpacing: '.02em', marginBottom: '8px' }}>THIS WORLD ISN'T HERE</div>
      <div style={{ fontSize: '13px', color: 'var(--cream-low)', lineHeight: 1.6, marginBottom: '20px' }}>Everyone on The Collectiv4 is a real world now — find the ones that are.</div>
      <button className="pressable" onClick={() => navigate('/community')}
        style={{ background: 'rgba(var(--ink-rgb),.06)', border: '1px solid rgba(var(--ink-rgb),.18)', borderRadius: '100px', padding: '10px 20px', color: 'var(--cream-mid)', fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
        ← Community
      </button>
    </div>
  )
}
