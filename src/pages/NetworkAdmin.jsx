import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { Loader2, BadgeCheck, Search, ShieldCheck, ArrowLeft } from 'lucide-react'

/* =========================================================================
   NetworkAdmin — /network. Owner-only surface to grant/revoke the "our
   network" verified badge. Two layers of protection:
     • CLIENT gate (this page) — only OWNER_EMAILS see the tool.
     • SERVER gate — public.set_verified() re-checks the caller's JWT email
       (public.is_owner()); a non-owner call returns { ok:false, not_owner }.
   The client gate is convenience; the RPC is the real enforcement. Cosmos.
   ========================================================================= */

/* ---- brand palette (void · bone · chrome) — same universe as Discover ---- */
const VOID = '#0A0A0D'
const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const SILVER = '#C7C9D1'
const STAR = '#E8E9ED'
const CARD = '#0E0E13'
const HAIR = 'rgba(242,238,230,0.08)'
const HAIR_HI = 'rgba(242,238,230,0.15)'
const CHROME = 'linear-gradient(176deg,#EEF0F4 0%,#BFC2CB 20%,#83868F 40%,#F7F9FD 52%,#7E818A 63%,#CED1DA 82%,#9497A0 100%)'
const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

// Same owner allowlist as Discover.jsx + the DB is_owner(). Client gate only.
const OWNER_EMAILS = new Set(['patduranchacon@gmail.com', 'patduranchacon@icloud.com'])
const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''

export default function NetworkAdmin() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [pending, setPending] = useState(null)   // id currently toggling
  const [err, setErr] = useState('')

  const isOwner = !!user && OWNER_EMAILS.has((user.email || '').toLowerCase())

  useEffect(() => {
    if (authLoading || !isOwner) return
    let alive = true
    async function load() {
      setLoading(true)
      // Owner reads all profiles (RLS is_owner() allows demos too).
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, discipline, city, avatar_url, verified, is_demo')
        .order('verified', { ascending: false })
        .order('full_name', { ascending: true })
      if (!alive) return
      setRows(data || [])
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [authLoading, isOwner])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(r =>
      (r.full_name || '').toLowerCase().includes(s) ||
      (r.username || '').toLowerCase().includes(s) ||
      (r.discipline || '').toLowerCase().includes(s))
  }, [rows, q])

  async function toggle(row) {
    setErr('')
    setPending(row.id)
    try {
      const { data, error } = await supabase.rpc('set_verified', { p_target: row.id, p_verified: !row.verified })
      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error === 'not_owner' ? 'Not authorized (server).' : data?.error === 'not_found' ? 'Profile not found.' : 'Grant failed.')
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, verified: data.verified } : r))
    } catch (e) {
      setErr(e.message || 'Grant failed.')
    } finally {
      setPending(null)
    }
  }

  // --- gates ---
  if (authLoading) return <Center><Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} /></Center>
  if (!isOwner) return (
    <Center>
      <div style={{ textAlign: 'center' }}>
        <ShieldCheck size={26} style={{ color: BONE_LOW }} />
        <div style={{ fontFamily: 'DM Mono', fontSize: '11px', color: BONE_MID, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: '14px' }}>Owners only</div>
        <button onClick={() => navigate('/discover')} style={{ marginTop: '18px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '9px 18px', color: BONE_MID, fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.1em', cursor: 'pointer' }}>← Discover</button>
      </div>
    </Center>
  )

  const verifiedCount = rows.filter(r => r.verified).length

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'linear-gradient(180deg,#0B0B10 0%,#08080D 55%,#07080E 100%)', overflowX: 'hidden' }}>
      <div style={{ position: 'relative', zIndex: 2, padding: '26px 22px 60px', maxWidth: '640px', margin: '0 auto' }}>

        {/* header */}
        <button onClick={() => navigate('/discover')} aria-label="Back" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'transparent', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.14em', cursor: 'pointer', padding: 0, marginBottom: '20px' }}>
          <ArrowLeft size={13} /> DISCOVER
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: SILVER, letterSpacing: '.28em', paddingBottom: '9px' }}>◇</div>
          <div>
            <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.28em', textTransform: 'uppercase', marginBottom: '5px' }}>Our network · verified</div>
            <h1 style={{ fontFamily: 'Bebas Neue', fontSize: '46px', letterSpacing: '.02em', lineHeight: .85, margin: 0, ...chromeText }}>NETWORK</h1>
          </div>
        </div>

        {/* count line */}
        {!loading && (
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', margin: '18px 0 14px', display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span>{String(verifiedCount).padStart(2, '0')} verified · {String(rows.length).padStart(2, '0')} total</span>
            <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${HAIR_HI},transparent)` }} />
          </div>
        )}

        {/* search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', border: `1px solid ${HAIR_HI}`, borderRadius: '11px', padding: '10px 14px', background: CARD }}>
          <Search size={14} style={{ color: BONE_LOW, flexShrink: 0 }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, handle, or craft…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: BONE, fontFamily: 'DM Sans', fontSize: '14px' }} />
        </div>

        {err && <div style={{ marginTop: '12px', fontFamily: 'DM Mono', fontSize: '10px', color: '#E5A0A0', letterSpacing: '.06em' }}>⚠ {err}</div>}

        {/* list */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {shown.map(r => {
              const avatar = safeImg(r.avatar_url)
              const name = r.full_name || 'Unnamed'
              const busy = pending === r.id
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 13px', borderRadius: '13px', border: `1px solid ${r.verified ? 'rgba(199,201,209,.28)' : HAIR}`, background: r.verified ? 'rgba(199,201,209,.05)' : CARD, transition: 'all .2s' }}>
                  {/* avatar */}
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: VOID, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontFamily: 'Bebas Neue', fontSize: '17px', ...chromeText }}>{name[0].toUpperCase()}</span>}
                  </div>
                  {/* identity */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'DM Sans', fontSize: '14px', color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                      {r.verified && <BadgeCheck size={14} style={{ color: STAR, flexShrink: 0, filter: 'drop-shadow(0 0 6px rgba(232,233,237,.5))' }} />}
                      {r.is_demo && <span style={{ fontFamily: 'DM Mono', fontSize: '7px', color: BONE_LOW, letterSpacing: '.1em', border: `1px solid ${HAIR}`, borderRadius: '4px', padding: '1px 5px', flexShrink: 0 }}>DEMO</span>}
                    </div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.06em', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.username ? `@${r.username}` : '—'}{r.discipline ? ` · ${r.discipline}` : ''}
                    </div>
                  </div>
                  {/* toggle */}
                  <button onClick={() => toggle(r)} disabled={busy}
                    style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '100px', padding: '7px 13px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, transition: 'all .2s',
                      border: `1px solid ${r.verified ? SILVER : HAIR_HI}`, background: r.verified ? 'rgba(199,201,209,.12)' : 'transparent',
                      color: r.verified ? BONE : BONE_MID, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase' }}>
                    {busy ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <BadgeCheck size={11} />}
                    {r.verified ? 'Verified' : 'Grant'}
                  </button>
                </div>
              )
            })}
            {shown.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'DM Mono', fontSize: '10px', color: BONE_LOW, letterSpacing: '.12em' }}>NO PROFILES MATCH</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Center({ children }) {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#0B0B10 0%,#07080E 100%)', padding: '40px' }}>{children}</div>
}
