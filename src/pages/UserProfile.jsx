import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { ArrowLeft } from 'lucide-react'
import ProfileMuseum from '@/components/ProfileMuseum'

export default function UserProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const live = useLiveEvent()
  const [profile, setProfile] = useState(null)
  const [going, setGoing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      // Public read of the profile row (profiles_public_read RLS = using(true)).
      const { data: p } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()

      // "Going" status comes from the PII-safe RPC, NOT a ticket select — the
      // tickets_self_read RLS policy blocks reading another person's ticket.
      // The RPC also supplies name/avatar when the user has no profile row yet.
      // Scope to the live event when there is one, so "going" means going to THIS
      // event; with no published event the RPC defaults to all confirmed.
      let att = null
      try {
        const { data } = await supabase.rpc('confirmed_attendees', live.id ? { p_event: live.id } : {})
        att = (data || []).find(a => String(a.id) === String(id)) || null
      } catch { /* RPC optional */ }

      if (!alive) return
      setGoing(!!att)
      setProfile(p || (att ? { id, full_name: att.name, avatar_url: att.avatar_url } : null))
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [id, live.id])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ fontFamily: 'DM Mono', fontSize: '11px', color: 'var(--cream-low)' }}>Loading...</div>
    </div>
  )

  if (!profile) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px', background: 'var(--bg)', padding: '40px' }}>
      <div style={{ fontSize: '13px', color: 'var(--cream-low)' }}>Profile not found</div>
      <button onClick={() => navigate('/community')} style={{ background: 'rgba(242,230,208,.06)', border: '1px solid var(--border-hi)', borderRadius: '8px', padding: '9px 18px', color: 'var(--cream-mid)', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans' }}>Back to Community</button>
    </div>
  )

  const topBar = (
    <>
      <button onClick={() => navigate(-1)} aria-label="Back" style={{ background: 'none', border: 'none', color: 'var(--cream)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ArrowLeft size={18} /></button>
      <span />
    </>
  )

  return <ProfileMuseum profile={profile} isOwner={false} ticket={going} event={live} topBar={topBar} />
}
