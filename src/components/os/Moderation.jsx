import { useState, useEffect, useMemo } from 'react'
import { Loader2, Search, ShieldCheck, ShieldAlert, BadgeCheck, Shield, Trash2, RotateCcw, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/api/supabase'
import { VOID, BONE, BONE_MID, BONE_LOW, FAINT, SILVER, STAR, CARD, HAIR, HAIR_HI, WARN, FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText, safeImg, relTime } from '@/lib/cosmos'

/* =========================================================================
   Moderation — LA LIMPIEZA (D2). The founder's assistant for the bots, per
   the 15-jul amendment. NOT a bot-hunter that decides: this surface only
   SHOWS raw evidence — sign-up date, email/domain, what they wrote, what
   they touched — account by account, and the FOUNDER decides. Nothing here
   auto-purges. Ever.

   Two truths held apart: INCOMPLETE (registered, no world yet — an onboarding
   OPPORTUNITY, not a bot) vs the accounts worth an eyeball. Cohort-zero is
   PROTECTED (whitelisted, un-purgeable) so a real teammate can never be one
   dedo-slip from deletion. Purge = reversible soft-delete (30-day window);
   Restore brings them right back.

   OWNER-ONLY at the DB: admin_list_accounts / admin_soft_purge / admin_restore
   / admin_set_protected each re-check is_owner() on the unforgeable JWT email.
   Non-optimistic (the Network pattern): re-read the DB's truth after each act.
   ========================================================================= */

const hasWorld = (a) => a.has_profile && ((a.posts || 0) > 0 || (a.crafts || 0) > 0 || (a.tastes || 0) > 0 || a.has_avatar || (a.bio_len || 0) > 0)
function bucketOf(a) {
  if (a.deleted_at) return 'purged'
  if (a.protected) return 'protected'
  if (a.is_demo) return 'demo'
  return hasWorld(a) ? 'building' : 'incomplete'
}
const FILTERS = [
  { key: 'review', label: 'Review', test: a => !a.is_demo && !a.deleted_at },
  { key: 'incomplete', label: 'Incomplete', test: a => bucketOf(a) === 'incomplete' },
  { key: 'building', label: 'Building', test: a => bucketOf(a) === 'building' },
  { key: 'protected', label: 'Protected', test: a => !!a.protected },
  { key: 'purged', label: 'Purged', test: a => !!a.deleted_at },
  { key: 'demo', label: 'Demo', test: a => !!a.is_demo },
  { key: 'all', label: 'All', test: () => true },
]

export default function Moderation() {
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [denied, setDenied] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('review')
  const [pending, setPending] = useState(null)
  const [confirmPurge, setConfirmPurge] = useState(null)   // id awaiting a second tap
  const [purgingSeed, setPurgingSeed] = useState(false)    // v9 D3: bulk seed purge in flight
  const [reload, setReload] = useState(0)
  // SHOW SEED (v8 adición C) — the founders' deliberate door back into the
  // 112 demo personas. Default OFF: since 0033 the seed is invisible to
  // every consumer surface (RLS floor); this preference only re-opens the
  // Community preview for THIS founder's browser. Nothing is deleted.
  const [seedVisible, setSeedVisible] = useState(() => { try { return localStorage.getItem('c4_seed_visible') === '1' } catch { return false } })
  const toggleSeed = () => setSeedVisible(v => { const n = !v; try { localStorage.setItem('c4_seed_visible', n ? '1' : '0') } catch { /* private mode */ } return n })

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setLoadErr(''); setDenied(false)
      const { data, error } = await supabase.rpc('admin_list_accounts')
      if (!alive) return
      if (error) { setLoadErr(error.message || 'Could not reach the accounts.'); setLoading(false); return }
      if (!data?.ok) { setDenied(true); setLoading(false); return }   // not_owner
      setAccounts(Array.isArray(data.accounts) ? data.accounts : [])
      setLoading(false)
    })()
    return () => { alive = false }
  }, [reload])

  const shown = useMemo(() => {
    const f = FILTERS.find(x => x.key === filter) || FILTERS[0]
    const s = q.trim().toLowerCase()
    return accounts.filter(f.test).filter(a => !s ||
      (a.full_name || '').toLowerCase().includes(s) ||
      (a.username || '').toLowerCase().includes(s) ||
      (a.email || '').toLowerCase().includes(s))
  }, [accounts, filter, q])

  async function refresh() {
    const { data, error } = await supabase.rpc('admin_list_accounts')
    if (!error && data?.ok) setAccounts(Array.isArray(data.accounts) ? data.accounts : [])
  }

  async function act(fn, args, id) {
    setErr(''); setPending(id)
    try {
      const { data, error } = await supabase.rpc(fn, args)
      if (error) throw new Error(error.message)
      if (!data?.ok) {
        const map = { not_owner: 'Owners only (server said no).', not_found: 'No world on that account — nothing to change.', protected: 'That account is protected — unprotect it first.' }
        throw new Error(map[data?.error] || data?.error || 'Could not update.')
      }
      await refresh()
    } catch (e) { setErr(e.message || 'Could not update.') }
    finally { setPending(null); setConfirmPurge(null) }
  }

  const setProtected = (a) => act('admin_set_protected', { p_user: a.id, p_protected: !a.protected }, a.id)
  const restore = (a) => act('admin_restore', { p_user: a.id }, a.id)
  const purge = (a) => {
    if (confirmPurge !== a.id) { setConfirmPurge(a.id); return }   // two-tap: a real member is never one click from deletion
    act('admin_soft_purge', { p_user: a.id }, a.id)
  }

  // v9 D3 (guardrail 3): the seed is purgable in ONE action, not ~200 taps.
  // Soft-delete (reversible via the Purged filter); protected rows untouched.
  const purgeSeed = async () => {
    const n = accounts.filter(a => a.is_demo && !a.deleted_at && !a.protected).length
    if (!n || purgingSeed) return
    if (!window.confirm(`Soft-delete all ${n} seed worlds? Reversible — restore any from the Purged filter.`)) return
    setErr(''); setPurgingSeed(true)
    try {
      const { data, error } = await supabase.rpc('admin_purge_seed')
      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error === 'not_owner' ? 'Owners only (server said no).' : (data?.error || 'Could not purge the seed.'))
      await refresh()
    } catch (e) { setErr(e.message || 'Could not purge the seed.') }
    finally { setPurgingSeed(false) }
  }

  if (loading) return <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}><Loader2 size={18} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} /></div>

  if (denied) return (
    <div style={{ padding: '50px 0', textAlign: 'center' }}>
      <ShieldCheck size={22} style={{ color: BONE_LOW }} />
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: '12px' }}>Owners only</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, marginTop: '8px', lineHeight: 1.6 }}>Moderation is a founder action — the server checks the signed session, not the screen.</div>
    </div>
  )

  if (loadErr) return (
    <div style={{ padding: '50px 0', textAlign: 'center' }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.14em', textTransform: 'uppercase' }}>couldn't load the accounts</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, marginTop: '8px' }}>{loadErr}</div>
      <button onClick={() => setReload(n => n + 1)} style={{ marginTop: '16px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '8px 16px', color: BONE_MID, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.1em', cursor: 'pointer' }}>↻ Retry</button>
    </div>
  )

  const real = accounts.filter(a => !a.is_demo && !a.deleted_at).length
  const purged = accounts.filter(a => a.deleted_at).length
  const seedCount = accounts.filter(a => a.is_demo && !a.deleted_at && !a.protected).length

  return (
    <div style={{ maxWidth: '820px' }}>
      {/* count line — honest totals, seed kept apart */}
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', margin: '2px 0 12px', display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
        <span>{String(real).padStart(2, '0')} real · {String(purged).padStart(2, '0')} purged · {String(accounts.length).padStart(2, '0')} registered</span>
        <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${HAIR_HI},transparent)` }} />
        {/* the seed's one door (v8 C): default OFF — founders see the real
            platform like everyone else; this reopens the preview on purpose */}
        <button data-testid="show-seed-toggle" onClick={toggleSeed}
          title="Show the demo seed in Community's preview (this browser only)"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: seedVisible ? 'rgba(199,201,209,.12)' : 'transparent', border: `1px solid ${seedVisible ? SILVER : HAIR_HI}`, borderRadius: '100px', padding: '5px 12px', color: seedVisible ? BONE : BONE_LOW, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all .2s' }}>
          {seedVisible ? <Eye size={11} /> : <EyeOff size={11} />} show seed · {seedVisible ? 'on' : 'off'}
        </button>
        {/* v9 D3 (guardrail 3): purge the whole seed in one action — soft,
            reversible, protected rows spared. Only shows when there's seed. */}
        {seedCount > 0 && (
          <button data-testid="purge-seed-all" onClick={purgeSeed} disabled={purgingSeed}
            title="Soft-delete every seed world at once (reversible from the Purged filter)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(214,120,120,.4)', borderRadius: '100px', padding: '5px 12px', color: WARN, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: purgingSeed ? 'default' : 'pointer', opacity: purgingSeed ? .6 : 1 }}>
            {purgingSeed ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={11} />} purge seed · {seedCount}
          </button>
        )}
      </div>

      {/* filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {FILTERS.map(f => {
          const on = filter === f.key
          const n = accounts.filter(f.test).length
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ borderRadius: '100px', padding: '5px 11px', cursor: 'pointer', border: `1px solid ${on ? SILVER : HAIR}`, background: on ? 'rgba(199,201,209,.1)' : 'transparent', color: on ? BONE : BONE_LOW, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              {f.label} {n > 0 && <span style={{ color: FAINT }}>{n}</span>}
            </button>
          )
        })}
      </div>

      {/* search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', border: `1px solid ${HAIR_HI}`, borderRadius: '11px', padding: '10px 14px', background: CARD }}>
        <Search size={14} style={{ color: BONE_LOW, flexShrink: 0 }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, handle, or email…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: BONE, fontFamily: FONT_SANS, fontSize: '14px' }} />
      </div>

      {err && <div style={{ marginTop: '12px', fontFamily: FONT_MONO, fontSize: '10px', color: WARN, letterSpacing: '.06em' }}>⚠ {err}</div>}

      {/* list — raw evidence, no verdict */}
      <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {shown.map(a => {
          const b = bucketOf(a)
          const avatar = safeImg(a.avatar_url)
          const name = a.full_name || (a.email ? a.email.split('@')[0] : 'Unnamed')
          const domain = (a.email || '').split('@')[1] || ''
          const busy = pending === a.id
          const activity = [
            (a.posts || 0) && `${a.posts} posts`, (a.crafts || 0) && `${a.crafts} crafts`,
            (a.tastes || 0) && `${a.tastes} tastes`, (a.follows_in || 0) && `${a.follows_in} followers`,
            (a.listings || 0) && `${a.listings} listings`, (a.tickets || 0) && `${a.tickets} tickets`,
          ].filter(Boolean).join(' · ')
          const purgedRow = !!a.deleted_at
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '11px 13px', borderRadius: '13px', border: `1px solid ${a.protected ? 'rgba(199,201,209,.28)' : HAIR}`, background: purgedRow ? 'rgba(214,120,120,.05)' : a.protected ? 'rgba(199,201,209,.05)' : CARD, opacity: purgedRow ? 0.72 : 1 }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: VOID, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontFamily: FONT_DISPLAY, fontSize: '16px', ...chromeText }}>{name[0].toUpperCase()}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: FONT_SANS, fontSize: '14px', color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: purgedRow ? 'line-through' : 'none' }}>{name}</span>
                  {a.verified && <BadgeCheck size={13} style={{ color: STAR, flexShrink: 0 }} />}
                  {a.protected && <Tag tone="star">protected</Tag>}
                  {b === 'incomplete' && <Tag>incomplete</Tag>}
                  {!a.has_profile && <Tag>no world yet</Tag>}
                  {a.is_demo && <Tag>demo</Tag>}
                  {purgedRow && <Tag tone="warn">purged {relTime(a.deleted_at)}</Tag>}
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.05em', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.email}{a.username ? ` · @${a.username}` : ''}{a.city ? ` · ${a.city}` : ''}
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.06em', marginTop: '3px' }}>
                  signed up {relTime(a.registered)}{a.last_sign_in ? ` · last seen ${relTime(a.last_sign_in)}` : ' · never signed in'}{domain ? ` · ${domain}` : ''}
                </div>
                {activity && <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.05em', marginTop: '3px' }}>{activity}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, alignItems: 'flex-end' }}>
                {purgedRow ? (
                  <ActBtn onClick={() => restore(a)} busy={busy} icon={RotateCcw} label="Restore" tone="star" />
                ) : (
                  <>
                    {a.has_profile && <ActBtn onClick={() => setProtected(a)} busy={busy} icon={Shield} label={a.protected ? 'Protected' : 'Protect'} tone={a.protected ? 'star' : 'ghost'} />}
                    <ActBtn onClick={() => purge(a)} busy={busy} disabled={a.protected || !a.has_profile}
                      icon={confirmPurge === a.id ? ShieldAlert : Trash2}
                      label={a.protected ? '—' : !a.has_profile ? 'no world' : confirmPurge === a.id ? 'Confirm?' : 'Purge'}
                      tone={confirmPurge === a.id ? 'warn' : 'ghost'} />
                  </>
                )}
              </div>
            </div>
          )
        })}
        {shown.length === 0 && (
          <div style={{ textAlign: 'center', padding: '36px 0', fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.12em' }}>NO ACCOUNTS HERE</div>
        )}
      </div>
    </div>
  )
}

function ActBtn({ onClick, busy, disabled, icon: Icon, label, tone }) {
  const col = tone === 'star' ? BONE : tone === 'warn' ? WARN : BONE_MID
  const brd = tone === 'star' ? SILVER : tone === 'warn' ? 'rgba(214,120,120,.5)' : HAIR_HI
  return (
    <button onClick={onClick} disabled={busy || disabled}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '100px', padding: '6px 12px', cursor: (busy || disabled) ? 'default' : 'pointer', opacity: disabled ? 0.4 : busy ? 0.6 : 1, border: `1px solid ${brd}`, background: 'transparent', color: col, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
      {busy ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Icon size={11} />}
      {label}
    </button>
  )
}

function Tag({ children, tone }) {
  const col = tone === 'star' ? STAR : tone === 'warn' ? WARN : BONE_LOW
  const brd = tone === 'warn' ? 'rgba(214,120,120,.4)' : HAIR
  return <span style={{ fontFamily: FONT_MONO, fontSize: '7px', color: col, letterSpacing: '.1em', textTransform: 'uppercase', border: `1px solid ${brd}`, borderRadius: '4px', padding: '1px 5px', flexShrink: 0 }}>{children}</span>
}
