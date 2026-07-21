import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, Check, X, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { useWide } from '@/lib/useIsDesktop'
import AuthResolving from '@/components/AuthResolving'
import { MoreChip, StateChip } from '@/components/Chip'
import {
  myCircle, fetchFollowers, fetchFollowing, respondFriend, removeFriend,
  unfollow as unfollowFn, follow as followFn,
  addCloseFriend, removeCloseFriend, myCloseFriends,
} from '@/lib/social'
import { announceSignalsChange } from '@/lib/signals'
import { VOCAB } from '@/lib/socialVocab'
import {
  BONE, BONE_MID, BONE_LOW, SILVER, FAINT, HAIR, HAIR_HI, CARD,
  FONT_DISPLAY, FONT_MONO, FONT_SANS, CHROME, safeImg,
} from '@/lib/cosmos'

/* =========================================================================
   CONNECTIONS — la gestión de tus vínculos (v13).

   ─── QUÉ RESUELVE ───────────────────────────────────────────────────────
   La capa social existía (connect, follow, close friends) pero no había UN
   lugar donde VERLA y administrarla. Esto es ese lugar: quién está en tu
   círculo, quién te pidió conexión, a quién sigues, quién te sigue, y tu
   círculo íntimo — todo con sus acciones reales, en vivo.

   ─── RESPETA LA DOCTRINA RLS ────────────────────────────────────────────
   Cada lectura es TUYA. my_circle / fetchFollowers / fetchFollowing /
   my_close_friends resuelven contra auth.uid() por RLS; la lista de otra
   persona no se abre desde aquí, se llame como se llame (socialVocab: "las
   conexiones son privadas — sólo las ven las dos personas"). Este surface no
   inventa un permiso nuevo: sólo compone los que ya existen.

   ─── EL HANDSHAKE, VISIBLE ──────────────────────────────────────────────
   my_circle ya devuelve friends / pending_in / pending_out. El segmento
   REQUESTS es donde el handshake se completa: un pending_in se acepta o se
   ignora aquí, y eso dispara friend_accept (la campana, 0042) al otro lado.

   ─── OPTIMISTA CON REVERSIÓN HONESTA ────────────────────────────────────
   Cada acción se pinta antes de que el servidor conteste y se revierte
   limpio si falla (Ley 11). Una lista social que espera 400ms por cada tap
   se siente rota; una que miente cuando el servidor dice no, peor.
   ========================================================================= */

const SEGS = [
  { key: 'connected', label: 'Connected' },
  { key: 'requests',  label: 'Requests' },
  { key: 'following', label: 'Following' },
  { key: 'followers', label: 'Followers' },
]

export default function Connections() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const wide = useWide()

  /* el segmento vive en la URL (?seg=) — igual que en Messages. No es
     cosmética: la campana de friend_request tiene que poder aterrizar en
     REQUESTS, que es donde el handshake se cierra. Sin esto la campana
     cumple a medias (Ley 9) — te deja en la puerta, no en el cuarto. */
  const [searchParams, setSearchParams] = useSearchParams()
  const rawSeg = searchParams.get('seg')
  const seg = SEGS.some((s) => s.key === rawSeg) ? rawSeg : 'connected'
  const setSeg = (s) => setSearchParams(s === 'connected' ? {} : { seg: s }, { replace: true })

  const [circle, setCircle] = useState(null)          // { friends, pending_in, pending_out }
  const [followers, setFollowers] = useState(null)
  const [following, setFollowing] = useState(null)
  const [closeSet, setCloseSet] = useState(new Set()) // ids en tu círculo íntimo
  const [busyId, setBusyId] = useState('')

  const load = useCallback(() => {
    if (!user) return
    myCircle().then(setCircle)
    fetchFollowers(user.id).then(setFollowers)
    fetchFollowing(user.id).then(setFollowing)
    myCloseFriends().then((list) => setCloseSet(new Set(list.map((p) => p.id || p.friend_id))))
  }, [user])

  useEffect(() => { load() }, [load])

  /* el rebote a casa vive en un efecto, no en el render: navegar durante el
     render es un efecto secundario y React lo castiga con un warning y, en
     el peor caso, un update sobre un componente que se está montando. */
  useEffect(() => {
    if (!authLoading && !user) navigate('/', { replace: true })
  }, [authLoading, user, navigate])

  if (authLoading) return <AuthResolving />
  if (!user) return null

  const pendingCount = (circle?.pending_in?.length || 0)

  /* ── acciones (optimistas, revierten a la verdad del servidor) ── */
  const withBusy = async (id, fn, revert) => {
    if (busyId) return
    setBusyId(id)
    try { await fn(); announceSignalsChange() }
    catch { revert?.() }
    finally { setBusyId('') }
  }

  const acceptReq = (p) => withBusy(p.id, async () => {
    setCircle((c) => ({ ...c, pending_in: c.pending_in.filter((x) => x.id !== p.id), friends: [p, ...c.friends] }))
    await respondFriend(p.id, true)
  }, load)

  const ignoreReq = (p) => withBusy(p.id, async () => {
    setCircle((c) => ({ ...c, pending_in: c.pending_in.filter((x) => x.id !== p.id) }))
    await respondFriend(p.id, false)
  }, load)

  /* Quitar la conexión BORRA también la fila de close friends. La lectura ya
     era honesta —is_close y my_close_friends llevan are_friends adentro
     (0029), así que un ex-connected no ve nada— pero la fila sobrevivía: si
     las dos personas se volvían a conectar meses después, el otro reaparecía
     en tu círculo íntimo sin que vos lo eligieras. Un círculo privado no se
     rearma solo. Se limpia acá, del lado del cliente, porque remove_friend
     vive en la DB de producción y esto no necesita tocarla. */
  const removeConn = (p) => withBusy(p.id, async () => {
    const wasClose = closeSet.has(p.id)
    setCircle((c) => ({ ...c, friends: c.friends.filter((x) => x.id !== p.id) }))
    setCloseSet((s) => { const n = new Set(s); n.delete(p.id); return n })
    if (wasClose) await removeCloseFriend(p.id).catch(() => {})
    await removeFriend(p.id)
  }, load)

  const doUnfollow = (p) => withBusy(p.id, async () => {
    setFollowing((f) => f.filter((x) => x.id !== p.id))
    await unfollowFn(user.id, p.id)
  }, load)

  const followBack = (p) => withBusy(p.id, async () => {
    setFollowing((f) => [p, ...(f || [])])
    await followFn(user.id, p.id)
  }, load)

  const toggleClose = (p) => {
    const on = closeSet.has(p.id)
    return withBusy(p.id, async () => {
      setCloseSet((s) => { const n = new Set(s); on ? n.delete(p.id) : n.add(p.id); return n })
      if (on) await removeCloseFriend(p.id)
      else await addCloseFriend(p.id)
    }, load)
  }

  const followingIds = new Set((following || []).map((p) => p.id))

  return (
    <div style={{
      minHeight: '100vh',
      padding: wide ? '40px clamp(24px, 4vw, 56px) 96px' : '24px 18px 40px',
      maxWidth: wide ? '720px' : 'none', margin: wide ? '0 auto' : 0,
    }}>
      {/* header — el título es el único momento de cromo (Ley 8) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
        {!wide && (
          <button onClick={() => navigate(-1)} className="pressable" aria-label="Back"
            style={{ flexShrink: 0, width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(var(--ink-rgb),.05)', border: `1px solid ${HAIR_HI}`, color: BONE, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={15} />
          </button>
        )}
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase', marginBottom: '5px' }}>○ your people</div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: wide ? '48px' : '38px', lineHeight: 0.9, letterSpacing: '.01em', background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>CONNECTIONS</h1>
        </div>
      </div>

      {/* SEGMENTOS. Las cuatro palabras no caben en 390px con el tracking
          ancho de la casa: FOLLOWERS quedaba cortada contra el borde, sin
          nada que dijera que la tira se desliza — se leía como un bug, no
          como un carrusel. En angosto los cuatro se reparten el ancho y
          entran completos; de 1024 para arriba vuelven a su ritmo suelto. */}
      <div className="no-scrollbar" style={{ display: 'flex', gap: wide ? '6px' : '0px', overflowX: 'auto', marginBottom: '18px', borderBottom: `1px solid ${HAIR}`, paddingBottom: '2px' }}>
        {SEGS.map((s) => {
          const on = seg === s.key
          const badge = s.key === 'requests' && pendingCount > 0 ? pendingCount : null
          return (
            <button key={s.key} onClick={() => setSeg(s.key)} className="pressable"
              data-testid={`conn-seg-${s.key}`} role="tab" aria-selected={on}
              style={{
                position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
                ...(wide ? { flexShrink: 0, padding: '9px 12px 11px', letterSpacing: '.14em' }
                         : { flex: '1 1 0', minWidth: 0, padding: '9px 2px 11px', letterSpacing: '.06em' }),
                fontFamily: FONT_MONO, fontSize: '10px', textTransform: 'uppercase',
                color: on ? BONE : BONE_LOW,
                borderBottom: `2px solid ${on ? 'rgba(var(--ink-rgb),.85)' : 'transparent'}`, marginBottom: '-3px',
                transition: 'color .2s var(--ease-house)',
              }}>
              {s.label}
              {badge && <span style={{ marginLeft: wide ? '7px' : '4px', fontFamily: FONT_MONO, fontSize: '8px', color: 'var(--bg)', background: 'rgba(var(--ink-rgb),.9)', borderRadius: '100px', padding: '2px 5px' }}>{badge}</span>}
            </button>
          )
        })}
      </div>

      {/* listas */}
      {seg === 'connected' && (
        <PersonList people={circle?.friends} empty="No connections yet. Connect with someone from their world."
          render={(p) => (
            <>
              <CloseStar on={closeSet.has(p.id)} busy={busyId === p.id} onClick={() => toggleClose(p)}
                testid={`conn-close-${p.id}`} />
              <RowBtn label="Remove" busy={busyId === p.id} onClick={() => removeConn(p)} ghost
                testid={`conn-remove-${p.id}`} />
            </>
          )} onOpen={(p) => navigate('/user/' + p.id)} />
      )}

      {seg === 'requests' && (
        <div>
          <SubHead>Waiting on you</SubHead>
          <PersonList people={circle?.pending_in} empty="No incoming requests."
            render={(p) => (
              <>
                <RowBtn label={busyId === p.id ? '' : 'Accept'} busy={busyId === p.id} onClick={() => acceptReq(p)} solid icon={<Check size={13} />}
                  testid={`conn-accept-${p.id}`} />
                <RowBtn label="Ignore" onClick={() => ignoreReq(p)} ghost icon={<X size={13} />}
                  testid={`conn-ignore-${p.id}`} />
              </>
            )} onOpen={(p) => navigate('/user/' + p.id)} />

          <div style={{ height: '22px' }} />
          <SubHead>You asked</SubHead>
          <PersonList people={circle?.pending_out} empty="Nothing pending."
            render={() => <StateChip label={VOCAB.connectPending} tone={FAINT} />}
            onOpen={(p) => navigate('/user/' + p.id)} />
        </div>
      )}

      {seg === 'following' && (
        <PersonList people={following} empty="You're not following anyone yet."
          render={(p) => <RowBtn label="Unfollow" busy={busyId === p.id} onClick={() => doUnfollow(p)} ghost />}
          onOpen={(p) => navigate('/user/' + p.id)} />
      )}

      {seg === 'followers' && (
        <PersonList people={followers} empty="No followers yet."
          render={(p) => followingIds.has(p.id)
            ? <StateChip label={VOCAB.followingState} tone={SILVER} />
            : <RowBtn label="Follow back" busy={busyId === p.id} onClick={() => followBack(p)} solid />}
          onOpen={(p) => navigate('/user/' + p.id)} />
      )}
    </div>
  )
}

/* ── piezas ── */

function SubHead({ children }) {
  return <div style={{ fontFamily: FONT_MONO, fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase', margin: '0 0 12px' }}>{children}</div>
}

function PersonList({ people, empty, render, onOpen }) {
  if (people === null || people === undefined) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Loader2 size={18} color={FAINT} style={{ animation: 'spin 1s linear infinite' }} /></div>
  }
  if (people.length === 0) {
    return <div style={{ fontFamily: FONT_SANS, fontSize: '13px', color: BONE_LOW, lineHeight: 1.6, padding: '24px 4px', textAlign: 'center', maxWidth: '40ch', margin: '0 auto' }}>{empty}</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {people.map((p) => <PersonRow key={p.id} p={p} render={render} onOpen={() => onOpen(p)} />)}
    </div>
  )
}

function PersonRow({ p, render, onOpen }) {
  /* DOS FORMAS, UNA FILA. my_circle (0023) devuelve la identidad con la llave
     `name`; fetchFollowers/fetchFollowing devuelven la fila cruda de profiles,
     con `full_name`. Esta página leía sólo `full_name`, así que CONNECTED y
     REQUESTS —justo los dos segmentos que vienen de my_circle— pintaban a
     todo el mundo como "Unnamed", mientras FOLLOWING y FOLLOWERS salían bien.
     Se aceptan las dos llaves; CircleBlock en Messages ya lo hacía así. */
  const name = p.full_name || p.name || p.username || 'Unnamed'
  const avatar = safeImg(p.avatar_url)
  const craft = p.discipline || (Array.isArray(p.crafts) && p.crafts[0]?.name) || ''
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 4px', borderBottom: `1px solid ${HAIR}` }}>
      <button onClick={onOpen} className="pressable" aria-label={`Open ${name}'s world`}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
        <span style={{ flexShrink: 0, width: '42px', height: '42px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${SILVER}`, background: CARD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {avatar ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontFamily: FONT_DISPLAY, fontSize: '19px', color: BONE }}>{name[0].toUpperCase()}</span>}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: FONT_SANS, fontSize: '14.5px', color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          {craft && <span style={{ display: 'block', fontFamily: FONT_MONO, fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '3px' }}>{craft}</span>}
        </span>
      </button>
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '7px' }}>{render(p)}</span>
    </div>
  )
}

/* la estrella del círculo íntimo — llena cuando está dentro */
function CloseStar({ on, busy, onClick, testid }) {
  return (
    <button onClick={onClick} disabled={busy} className="pressable" aria-pressed={on}
      data-testid={testid}
      aria-label={on ? 'In your close friends' : 'Add to close friends'}
      title={on ? 'In your close friends' : 'Add to close friends'}
      style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '9px', background: on ? 'rgba(var(--ink-rgb),.08)' : 'transparent', border: `1px solid ${on ? 'rgba(var(--ink-rgb),.24)' : HAIR}`, cursor: busy ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {busy ? <Loader2 size={13} color={SILVER} style={{ animation: 'spin 1s linear infinite' }} />
        : <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1.6l1.7 3.9 4.2.4-3.2 2.8 1 4.1L8 10.6 4.3 12.8l1-4.1L2.1 5.9l4.2-.4z" fill={on ? BONE : 'none'} stroke={on ? BONE : BONE_LOW} strokeWidth="1" strokeLinejoin="round" /></svg>}
    </button>
  )
}

function RowBtn({ label, busy, onClick, solid, ghost, icon, testid }) {
  return (
    <button onClick={onClick} disabled={busy} className="pressable" data-testid={testid}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: busy ? 'default' : 'pointer',
        padding: '8px 13px', borderRadius: '100px',
        background: solid ? BONE : 'transparent',
        color: solid ? 'var(--bg)' : BONE_MID,
        border: solid ? 'none' : `1px solid ${HAIR_HI}`,
        fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        opacity: busy && !label ? .6 : 1,
      }}>
      {busy && !label ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : (<>{icon}{label}</>)}
    </button>
  )
}
