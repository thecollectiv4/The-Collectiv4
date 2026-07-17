import { useState, useEffect, useRef } from 'react'
import { searchPeople, requestFriend, respondFriend } from '@/lib/social'
import { isOwnerFounder } from '@/lib/osAccess'
import SeedPill from '@/components/SeedMark'
import { Search, Loader2, UserPlus, Check, Clock } from 'lucide-react'

/* =========================================================================
   PEOPLE SEARCH — the entry door to a friend request from YOUR OWN surface
   (v9 D1). The send door on a world already works; this is the other half
   the spec names: "buscar gente, mandar solicitud… desde una superficie
   propia." Find anyone by name or @handle, and send from the result row —
   the exact move behind the launch test, "agrega a Diego de amigo."

   State without N+1: each result's bond is derived from the circle already
   loaded upstream ({friends, pending_in, pending_out}) — no per-row probe.
   Ley 6: face + name lead every row. Ley 9: the button reflects the true
   state, never a dead promise. Ley 11: an honest empty, never filler.
   ========================================================================= */

const VOID = '#0A0A0D'
const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const SILVER = '#C7C9D1'
const STAR = '#E8E9ED'
const CARD = '#0E0E13'
const HAIR = 'rgba(242,238,230,0.08)'
const HAIR_HI = 'rgba(242,238,230,0.15)'
const WARN = '#E5A0A0'

const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''
const nameOf = (p) => p.name || p.full_name || (p.username ? '@' + p.username : 'Member')

/* the pairwise bond, read from the loaded circle — 'friends'|'in'|'out'|'none' */
function bondOf(id, circle) {
  if (circle.friends?.some((f) => f.id === id)) return 'friends'
  if (circle.pending_in?.some((p) => p.id === id)) return 'in'
  if (circle.pending_out?.some((p) => p.id === id)) return 'out'
  return 'none'
}

export default function PeopleSearch({ me, circle, onCircleChange, onOpenWorld }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)   // null = idle · [] = searched empty
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [err, setErr] = useState('')
  const reqRef = useRef(0)
  // guardrail 4: this search reaches the seed for founders (RLS 0033 admits
  // it unconditionally) — so it honors the /os SHOW SEED toggle like every
  // discovery surface (sweep catch: it ignored the toggle entirely)
  const [showSeed, setShowSeed] = useState(false)

  useEffect(() => {
    let alive = true
    let seedPref = import.meta.env?.VITE_DISCOVERY_PREVIEW === 'true'
    try { seedPref = seedPref || localStorage.getItem('c4_seed_visible') === '1' } catch { /* private mode */ }
    if (!me?.id || !seedPref) { setShowSeed(false); return undefined }
    isOwnerFounder().then((ok) => { if (alive) setShowSeed(!!ok) })
    return () => { alive = false }
  }, [me?.id])

  // debounced search — the newest query wins (a slow earlier response can't
  // overwrite a fresher one: the reqRef seq guards it)
  useEffect(() => {
    const clean = q.trim()
    // leaving the searchable range must INVALIDATE any in-flight search, or a
    // slow response can repaint stale rows under a cleared box (review catch)
    if (clean.length < 2) { reqRef.current++; setResults(null); setSearching(false); return }
    setSearching(true)
    const seq = ++reqRef.current
    const t = setTimeout(async () => {
      const rows = await searchPeople(clean, me.id)
      if (seq !== reqRef.current) return   // a newer keystroke already fired
      // seed rows render only under the toggle — and always labeled (Ley 11)
      setResults(rows.filter((p) => !p.is_demo || showSeed))
      setSearching(false)
    }, 240)
    return () => clearTimeout(t)
  }, [q, me.id, showSeed])

  // send a request — two reaches can meet (requestFriend answers 'accepted'
  // when theirs was already waiting), so honor whichever landed
  const send = async (person) => {
    if (busyId) return
    setBusyId(person.id); setErr('')
    const row = { id: person.id, name: nameOf(person), username: person.username, avatar_url: person.avatar_url, verified: person.verified, city: person.city, is_demo: person.is_demo }
    try {
      const status = await requestFriend(person.id)
      onCircleChange((c) => status === 'accepted'
        ? { ...c, friends: [...c.friends, row], pending_out: c.pending_out.filter((p) => p.id !== person.id) }
        : { ...c, pending_out: [...c.pending_out, row] })
    } catch (e) { setErr(e?.message || "that didn't land — try again") }
    finally { setBusyId(null) }
  }

  // accept a request that was already waiting on me (found via search)
  const accept = async (person) => {
    if (busyId) return
    setBusyId(person.id); setErr('')
    const row = { id: person.id, name: nameOf(person), username: person.username, avatar_url: person.avatar_url, verified: person.verified, city: person.city, is_demo: person.is_demo }
    try {
      await respondFriend(person.id, true)
      onCircleChange((c) => ({ ...c, friends: [...c.friends, row], pending_in: c.pending_in.filter((p) => p.id !== person.id) }))
    } catch (e) { setErr(e?.message || "that didn't land — try again") }
    finally { setBusyId(null) }
  }

  return (
    <div style={{ marginTop: '18px' }}>
      <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: '9px' }}>＋ add people</div>

      {/* the search field — one question, answered as you type (Ley 2) */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={14} strokeWidth={1.6} style={{ position: 'absolute', left: '13px', color: BONE_LOW, pointerEvents: 'none' }} />
        <input
          value={q} onChange={(e) => setQ(e.target.value)} data-testid="people-search-input"
          placeholder="search by name or @handle" autoComplete="off" aria-label="Search people by name or handle"
          style={{ width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 38px 12px 36px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none' }} />
        {searching && <Loader2 size={14} style={{ position: 'absolute', right: '13px', color: SILVER, animation: 'spin 1s linear infinite' }} />}
      </div>

      {err && <div role="alert" style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '10px' }}>⚠ {err}</div>}

      {/* results — faces first, the true bond on each button (Leyes 6, 9) */}
      {results && results.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          {results.map((person) => (
            <ResultRow key={person.id} person={person} bond={bondOf(person.id, circle)}
              busy={busyId === person.id} onSend={() => send(person)} onAccept={() => accept(person)}
              onOpen={() => onOpenWorld(person.id)} />
          ))}
        </div>
      )}

      {/* honest empty — searched, no one there (Ley 11) */}
      {results && results.length === 0 && !searching && (
        <div style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.6, marginTop: '12px', padding: '2px' }}>
          no one by “{q.trim()}” yet — try a name or their @handle.
        </div>
      )}
    </div>
  )
}

function ResultRow({ person, bond, busy, onSend, onAccept, onOpen }) {
  const name = nameOf(person)
  const avatar = safeImg(person.avatar_url)
  const sub = person.username ? '@' + person.username : (person.city || person.discipline || '')
  return (
    <div data-testid={`people-result-${person.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 2px', borderBottom: `1px solid ${HAIR}` }}>
      {/* the face + name tap to the world (Ley 6) */}
      <button className="pressable" onClick={onOpen} aria-label={`Open ${name}'s world`}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
        <span style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: CARD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {avatar
            ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontFamily: 'Bebas Neue', fontSize: '16px', color: BONE }}>{(name || '?')[0].toUpperCase()}</span>}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
            <span style={{ fontFamily: 'Bebas Neue', fontSize: '18px', color: BONE, letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{name}</span>
            <SeedPill is_demo={person.is_demo} />
          </span>
          {sub && <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.1em', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>}
        </span>
      </button>
      {/* the action — the true state, never a dead promise (Ley 9) */}
      <BondButton bond={bond} busy={busy} onSend={onSend} onAccept={onAccept} personId={person.id} />
    </div>
  )
}

function BondButton({ bond, busy, onSend, onAccept, personId }) {
  if (bond === 'friends') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: SILVER, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', flexShrink: 0, padding: '10px 6px' }}>
      <Check size={12} /> amigos
    </span>
  )
  if (bond === 'out') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', flexShrink: 0, padding: '10px 6px' }}>
      <Clock size={11} /> requested
    </span>
  )
  if (bond === 'in') return (
    <button className="pressable" data-testid={`people-accept-${personId}`} disabled={busy} onClick={onAccept}
      style={{ background: BONE, border: 'none', borderRadius: '100px', minHeight: '40px', padding: '10px 18px', color: VOID, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 500, cursor: busy ? 'default' : 'pointer', opacity: busy ? .5 : 1, flexShrink: 0 }}>
      {busy ? '…' : 'accept'}
    </button>
  )
  return (
    <button className="pressable" data-testid={`people-add-${personId}`} disabled={busy} onClick={onSend}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', minHeight: '40px', padding: '10px 16px', color: BONE, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: busy ? 'default' : 'pointer', opacity: busy ? .5 : 1, flexShrink: 0 }}>
      {busy ? '…' : <><UserPlus size={12} /> amigo</>}
    </button>
  )
}
