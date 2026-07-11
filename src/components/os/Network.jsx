import { useState, useEffect, useMemo } from 'react'
import { Loader2, BadgeCheck, Search, ShieldCheck } from 'lucide-react'
import { supabase } from '@/api/supabase'
import { VOID, BONE, BONE_MID, BONE_LOW, FAINT, SILVER, STAR, CARD, HAIR, HAIR_HI, WARN, FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText, safeImg, relTime } from '@/lib/cosmos'

/* =========================================================================
   Network — the founder's verification desk, inside the OS. Every
   REGISTERED account (auth.users via admin_list_users, 0014) — not just
   the ones that already opened /profile — searchable, and verified /
   unverified in one tap (admin_set_verified).

   OWNER-ONLY at the DB: both RPCs re-check is_owner() on the caller's
   unforgeable JWT email and answer not_owner to everyone else. The OS tab
   that mounts this is itself shown only on the server's owner verdict —
   but that's presentation; the gate lives here, server-side.

   Non-optimistic on purpose (the Events pattern): after every write we
   re-read and render the DB's truth, never the click's optimism.
   ========================================================================= */

export default function Network() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [denied, setDenied] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [pending, setPending] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setLoadErr(''); setDenied(false)
      const { data, error } = await supabase.rpc('admin_list_users')
      if (!alive) return
      if (error) { setLoadErr(error.message || 'Could not reach the network.'); setLoading(false); return }
      if (!data?.ok) { setDenied(true); setLoading(false); return }   // not_owner
      setUsers(Array.isArray(data.users) ? data.users : [])
      setLoading(false)
    })()
    return () => { alive = false }
  }, [reload])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return users
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(s) ||
      (u.username || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s) ||
      (u.discipline || '').toLowerCase().includes(s))
  }, [users, q])

  async function toggle(u) {
    setErr('')
    setPending(u.id)
    try {
      const { data, error } = await supabase.rpc('admin_set_verified', { p_user: u.id, p_verified: !u.verified })
      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error === 'not_owner' ? 'Owners only (server said no).' : data?.error === 'not_found' ? 'No registered account with that id.' : (data?.error || 'Could not update.'))
      // DB truth, not click optimism — re-read the list. If the re-read
      // fails, the write STILL landed: patch this row from the RPC's own
      // confirmed verdict so the button never shows a state the DB left.
      const { data: fresh, error: e2 } = await supabase.rpc('admin_list_users')
      if (!e2 && fresh?.ok) setUsers(Array.isArray(fresh.users) ? fresh.users : [])
      else setUsers(us => us.map(x => x.id === u.id ? { ...x, verified: !!data.verified, has_profile: true } : x))
    } catch (e) {
      setErr(e.message || 'Could not update.')
    } finally {
      setPending(null)
    }
  }

  if (loading) return <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}><Loader2 size={18} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} /></div>

  if (denied) return (
    <div style={{ padding: '50px 0', textAlign: 'center' }}>
      <ShieldCheck size={22} style={{ color: BONE_LOW }} />
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: '12px' }}>Owners only</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, marginTop: '8px', lineHeight: 1.6 }}>Verification is a founder action — the server checks the signed session, not the screen.</div>
    </div>
  )

  if (loadErr) return (
    <div style={{ padding: '50px 0', textAlign: 'center' }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.14em', textTransform: 'uppercase' }}>couldn't load the network</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, marginTop: '8px' }}>{loadErr}</div>
      <button onClick={() => setReload(n => n + 1)} style={{ marginTop: '16px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '8px 16px', color: BONE_MID, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.1em', cursor: 'pointer' }}>↻ Retry</button>
    </div>
  )

  const verifiedCount = users.filter(u => u.verified).length

  return (
    <div style={{ maxWidth: '760px' }}>
      {/* count line */}
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', margin: '2px 0 14px', display: 'flex', alignItems: 'center', gap: '9px' }}>
        <span>{String(verifiedCount).padStart(2, '0')} verified · {String(users.length).padStart(2, '0')} registered</span>
        <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${HAIR_HI},transparent)` }} />
      </div>

      {/* search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', border: `1px solid ${HAIR_HI}`, borderRadius: '11px', padding: '10px 14px', background: CARD }}>
        <Search size={14} style={{ color: BONE_LOW, flexShrink: 0 }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, handle, email, or craft…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: BONE, fontFamily: FONT_SANS, fontSize: '14px' }} />
      </div>

      {err && <div style={{ marginTop: '12px', fontFamily: FONT_MONO, fontSize: '10px', color: WARN, letterSpacing: '.06em' }}>⚠ {err}</div>}

      {/* list */}
      <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {shown.map(u => {
          const avatar = safeImg(u.avatar_url)
          const name = u.full_name || (u.email ? u.email.split('@')[0] : 'Unnamed')
          const busy = pending === u.id
          return (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 13px', borderRadius: '13px', border: `1px solid ${u.verified ? 'rgba(199,201,209,.28)' : HAIR}`, background: u.verified ? 'rgba(199,201,209,.05)' : CARD }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: VOID, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontFamily: FONT_DISPLAY, fontSize: '16px', ...chromeText }}>{name[0].toUpperCase()}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: FONT_SANS, fontSize: '14px', color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                  {u.verified && <BadgeCheck size={14} style={{ color: STAR, flexShrink: 0, filter: 'drop-shadow(0 0 6px rgba(232,233,237,.5))' }} />}
                  {u.is_demo && <Tag>demo</Tag>}
                  {!u.has_profile && <Tag>no world yet</Tag>}
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.06em', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.email}{u.username ? ` · @${u.username}` : ''}{u.discipline ? ` · ${u.discipline}` : ''}
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.08em', marginTop: '2px' }}>
                  registered {relTime(u.registered)}
                </div>
              </div>
              <button onClick={() => toggle(u)} disabled={busy}
                style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '100px', padding: '7px 13px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                  border: `1px solid ${u.verified ? SILVER : HAIR_HI}`, background: u.verified ? 'rgba(199,201,209,.12)' : 'transparent',
                  color: u.verified ? BONE : BONE_MID, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase' }}>
                {busy ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <BadgeCheck size={11} />}
                {u.verified ? 'Verified' : 'Verify'}
              </button>
            </div>
          )
        })}
        {shown.length === 0 && (
          <div style={{ textAlign: 'center', padding: '36px 0', fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.12em' }}>NO ACCOUNTS MATCH</div>
        )}
      </div>
    </div>
  )
}

function Tag({ children }) {
  return <span style={{ fontFamily: FONT_MONO, fontSize: '7px', color: BONE_LOW, letterSpacing: '.1em', textTransform: 'uppercase', border: `1px solid ${HAIR}`, borderRadius: '4px', padding: '1px 5px', flexShrink: 0 }}>{children}</span>
}
