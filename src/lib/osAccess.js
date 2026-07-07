import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'

/* Server-authoritative access for /os. The DB decides — my_os_identity() checks
   is_owner() OR the caller's own verified flag and returns the session profile.
   No client email list, fail-closed on error (the data is RLS-gated regardless). */
export function useOSAccess() {
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState('loading')   // loading | granted | denied
  const [profile, setProfile] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (authLoading) return
    let alive = true
    ;(async () => {
      setState('loading')
      if (!user) { if (alive) setState('denied'); return }
      const { data, error } = await supabase.rpc('my_os_identity')
      if (!alive) return
      if (error || !data?.member) { setState('denied'); return }
      setProfile(data.profile || null)
      setState('granted')
    })()
    return () => { alive = false }
  }, [user, authLoading, reload])

  return { state, profile, user, refresh: () => setReload(n => n + 1) }
}

/* Used by the post-login flows to send members to /os. Guarded + fail-safe:
   any error just returns false and the caller falls back to normal routing. */
export async function isNetworkMember() {
  try {
    const { data, error } = await supabase.rpc('my_os_identity')
    return !error && !!data?.member
  } catch { return false }
}
