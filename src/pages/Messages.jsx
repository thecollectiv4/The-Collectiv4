import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { useWide } from '@/lib/useIsDesktop'
import AuthResolving from '@/components/AuthResolving'
import Mark from '@/components/Mark'
import {
  socialReady, circleReady, fetchInbox, fetchThread, sendMessage, markThreadRead, subscribeThread, msgTime,
  myCircle, createCrew, leaveCrew, createPlan, rsvpPlan, cancelPlan, leavePlan, myPlans,
  setPlanVisibility, VIS_TIERS, VIS_LABEL, planWhen,
} from '@/lib/social'
import { useFocusTrap } from '@/lib/focusTrap'
import { fetchSignals, markSignalsRead, markThreadSignalsRead, signalLine, signalTo } from '@/lib/signals'
import SeedPill from '@/components/SeedMark'
import { Loader2, Send, ArrowLeft, Lock, MessagesSquare, CalendarDays, ArrowUpRight, X, Star, Globe, Users, Bell, Link2, Check } from 'lucide-react'
import { glassSurface, glassControl, CARD_TINT } from '@/lib/glass'

/* =========================================================================
   MESSAGES — the conversations that continue (D2: the Base44 chat rebuilt
   native). v17 — UNA LISTA (decisión de fundador, 23 jul): los tres tabs
   SIGNALS/CREWS/PLANS murieron. Si el fundador no podía explicarlos, un
   usuario nuevo menos. Ahora:
     /messages      → ONE list: every conversation and every room (dm,
                      event, crew, plan), ordered by recent activity.
                      The Bell keeps its panel, byte-identical.
     /messages/:id  → the thread: a DM pair, an event's room, a crew, or
                      a plan's room. A plan's room carries its PlanCard at
                      the top — RSVP, visibility, the door link: managing
                      the plan happens IN the plan's room, not in a tab.
   What moved OUT of this page in v17:
     · circle management (requests/roster/close friends) → /connections,
       which already owned it (the CREWS block here was a duplicate)
     · plan creation → CREATE (+) → ?new=plan handshake here
     · plan discovery → the EVENTS tab rail + /p/:id (0057)

   RLS is the wall: participants-only reads/writes (0017/0023), and the
   stream respects it too. The circle is private; no public counts
   anywhere. Ley 6: names and faces lead every row. Ley 11: pre-migration
   each layer says the wires are going in — no dead composer, no fake
   inbox. Ley 14: starlight.
   ========================================================================= */

const VOID = 'var(--bg)'
const VOID_2 = 'var(--bg-deep)'
const BONE = 'var(--cream)'
const BONE_MID = 'var(--cream-soft)'
const BONE_LOW = 'var(--cream-dim)'
const SILVER = 'var(--silver)'
const STAR = 'var(--star)'
const CARD = 'var(--card-solid)'
const HAIR = 'rgba(var(--ink-rgb),0.08)'
const HAIR_HI = 'rgba(var(--ink-rgb),0.15)'
const WARN = 'var(--warn)'
const CHROME = 'var(--chrome)' // deck formula — jewelry, one moment per screen (v8 D3)
const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''

const threadTitle = (t) => {
  if (t.kind === 'event') {
    const e = t.event
    return e ? `${e.title}${e.edition ? ' · ' + e.edition : ''}` : 'Event room'
  }
  if (t.kind === 'group') return t.title || 'The crew'
  if (t.kind === 'plan') return t.title || 'The plan'
  const o = t.others?.[0]
  return o?.full_name || (o?.username ? '@' + o.username : 'Member')
}

/* names above bubbles wherever more than two people share the room */
const isRoomKind = (kind) => kind === 'event' || kind === 'group' || kind === 'plan'

export default function Messages() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const wide = useWide()
  const [ready, setReady] = useState(null)   // null = probing · true · false

  useEffect(() => { socialReady().then(setReady) }, [])

  if (authLoading) return <AuthResolving />
  if (!user) return (
    <Shell wide={wide}>
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center' }}>
        <Lock size={22} strokeWidth={1.2} style={{ color: BONE_LOW, marginBottom: '18px' }} />
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: BONE, letterSpacing: '.02em', marginBottom: '8px' }}>YOUR CONVERSATIONS LIVE HERE</div>
        <div style={{ fontSize: '13px', color: BONE_MID, marginBottom: '26px', lineHeight: 1.6, maxWidth: '300px', fontFamily: 'DM Sans' }}>Sign in to message creatives and enter your event rooms.</div>
        {/* a shared /messages/:id deep link survives the sign-in (?next) */}
        <button className="pressable" onClick={() => navigate(`/auth?next=${encodeURIComponent(location.pathname)}`)} style={{ background: BONE, border: 'none', borderRadius: '10px', padding: '14px 36px', color: VOID, fontFamily: 'DM Sans', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Sign in</button>
      </div>
    </Shell>
  )

  if (ready === null) return (
    <Shell wide={wide}>
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
      </div>
    </Shell>
  )

  // pre-migration: the truth, said once, no dead doors (Leyes 9, 11)
  if (ready === false) return (
    <Shell wide={wide}>
      <Header wide={wide} count={null} />
      <div style={{ marginTop: '22px', padding: '42px 26px', borderRadius: '18px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(var(--star-rgb),.05), rgba(var(--star-rgb),.01))', textAlign: 'center' }}>
        <MessagesSquare size={22} strokeWidth={1.3} style={{ color: SILVER, marginBottom: '14px' }} />
        <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '28px', letterSpacing: '.03em', lineHeight: .95, margin: 0, color: BONE }}>THE WIRES ARE GOING IN</h2>
        <p style={{ fontFamily: 'DM Sans', fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, margin: '14px auto 0', maxWidth: '340px' }}>
          Messages switch on with the platform update rolling out now — DMs with creatives, and a room chat for every event you're in.
        </p>
      </div>
    </Shell>
  )

  return id
    ? <Thread key={id} threadId={id} me={user} wide={wide} />
    : <Inbox me={user} wide={wide} />
}

/* ------------------------------- inbox ------------------------------- */
function Inbox({ me, wide }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [threads, setThreads] = useState([])
  const [circle, setCircle] = useState(null)     // null = probing · true · false (0023 not live)
  const [circleData, setCircleData] = useState({ friends: [], pending_in: [], pending_out: [] })
  const [crewSheet, setCrewSheet] = useState(false)
  const [planSheet, setPlanSheet] = useState(false)
  const [bells, setBells] = useState({ unread: 0, signals: [] })   // LAS CAMPANAS (v10 D2)
  /* v16 — The Bell dejó de ser un bloque arriba de la lista: es un PANEL
     propio, abierto desde el ícono de campana del encabezado (badge con
     no-leídas). La lista queda limpia: solo conversaciones y salas. */
  const [bellOpen, setBellOpen] = useState(false)

  useEffect(() => {
    let alive = true
    fetchInbox(me.id).then((rows) => { if (alive) { setThreads(rows); setLoading(false) } })
    // the bell inbox (0042) — empty shape pre-migration, so nothing dead renders
    fetchSignals(50).then((b) => { if (alive) setBells(b) })
    circleReady().then((r) => {
      if (!alive) return
      setCircle(r)
      // friends feed the two composers (CrewSheet / PlanSheet) only — the
      // circle-management UI itself lives in /connections since v17
      if (r) myCircle().then((c) => { if (alive) setCircleData(c) })
    })
    return () => { alive = false }
  }, [me.id])

  // ?new=plan (CREATE's door since v17 — the old ?seg=plans&new=1 handshake
  // died with the tabs) opens the plan sheet ONCE, then the param is
  // stripped — a reload doesn't re-open it
  useEffect(() => {
    if (searchParams.get('new') !== 'plan') return
    if (circle === null) return                     // wait for the probe
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next, { replace: true })
    if (circle === true) setPlanSheet(true)
  }, [circle, searchParams, setSearchParams])

  /* v17 — UNA LISTA: every thread the wall lets you read, one wire, most
     recent activity first (fetchInbox already sorts by last_message_at).
     Plan rooms enter the list for the FIRST time here — before v17 they
     hid behind each PlanCard's door in a tab nobody could explain. */
  const booting = loading || circle === null
  const count = booting ? null : threads.length

  return (
    <Shell wide={wide}>
      <Header wide={wide} count={count} bellUnread={bells.unread} onBell={() => setBellOpen(true)} />

      {booting ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ maxWidth: wide ? '720px' : undefined }}>

          {/* v16: aquí vivía el bloque TheBell — se mudó al panel de la
              campana (encabezado, arriba a la derecha). La lista respira. */}
          {/* ---------------- UNA LISTA — everything, most recent first ---------------- */}
          {threads.length === 0 ? (
            <div style={{ marginTop: '22px', padding: '42px 26px', borderRadius: '18px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(var(--star-rgb),.05), rgba(var(--star-rgb),.01))', textAlign: 'center' }}>
              <MessagesSquare size={22} strokeWidth={1.3} style={{ color: SILVER, marginBottom: '14px' }} />
              <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '28px', letterSpacing: '.03em', lineHeight: .95, margin: 0, color: BONE }}>NO CONVERSATIONS YET</h2>
              <p style={{ fontFamily: 'DM Sans', fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, margin: '14px auto 0', maxWidth: '320px' }}>
                Walk into a world and say something — every creative's museum has a door.
              </p>
              <button className="pressable" onClick={() => navigate('/community')} style={{ marginTop: '22px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: BONE, border: 'none', borderRadius: '11px', padding: '13px 24px', color: VOID, fontFamily: 'DM Sans', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Find your people <ArrowUpRight size={16} />
              </button>
            </div>
          ) : (
            <div style={{ marginTop: '14px' }}>
              {threads.map((t, i) => (
                <InboxRow key={t.id} t={t} me={me} last={i === threads.length - 1} onOpen={() => navigate('/messages/' + t.id)} />
              ))}
            </div>
          )}

          {/* the one room-making act that still lives here: a crew is a
              room of YOUR people, and Messages is where rooms live. Plans
              are made from CREATE (+) since v17. Friendless = no door —
              honest, not hidden: crews are built FROM friendship (0023). */}
          {circle === true && circleData.friends.length > 0 && (
            <CreateRow testid="crew-create" title="START A CREW" kicker="your people, one room" onGo={() => setCrewSheet(true)} />
          )}
        </div>
      )}

      {/* v16 — EL PANEL DE LA CAMPANA. Portaleado a body (el patrón de la
          casa para overlays: el wrapper de transición de Layout anima
          transform y un fixed adentro anclaría mal a mitad de animación). */}
      {bellOpen && (
        <BellPanel bells={bells} onClose={() => setBellOpen(false)}
          onOpen={(s) => {
            if (!s.read_at) {
              // optimistic, with the honest rollback: a null return means
              // the door refused — refetch server truth (Ley 11)
              markSignalsRead([s.id]).then((n) => { if (n === null) fetchSignals(50).then(setBells) })
              setBells((b) => ({ unread: Math.max(0, b.unread - 1), signals: b.signals.map((x) => x.id === s.id ? { ...x, read_at: new Date().toISOString() } : x) }))
            }
            setBellOpen(false)
            navigate(signalTo(s))
          }}
          onMarkAll={() => {
            markSignalsRead(null).then((n) => { if (n === null) fetchSignals(50).then(setBells) })
            setBells((b) => ({ unread: 0, signals: b.signals.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })) }))
          }} />
      )}

      {crewSheet && (
        <CrewSheet friends={circleData.friends} onClose={() => setCrewSheet(false)}
          onGoCommunity={() => { setCrewSheet(false); navigate('/community') }}
          onCreated={(threadId) => navigate('/messages/' + threadId)} />
      )}
      {planSheet && (
        <PlanSheet friends={circleData.friends} onClose={() => setPlanSheet(false)}
          onCreated={(planId, threadId) => {
            // v17: making a plan LANDS YOU IN ITS ROOM — the same door a
            // stranger gets from /p/:id. No tab to return to; the room is
            // the plan's home now.
            setPlanSheet(false)
            navigate(threadId ? '/messages/' + threadId : '/messages')
          }} />
      )}
    </Shell>
  )
}

/* THE BELL (v10 D2 · Las Campanas → v16 EL PANEL) — the notification inbox,
   quiet by law: each row keeps its promise (the tap opens the surface it
   names and marks itself read). v16: dejó de ser un bloque arriba de la
   lista de SIGNALS — es un panel lateral propio, abierto desde la campana
   del encabezado, con el stream completo (50) y scroll. Los testids
   (bell-block / bell-row-* / bell-mark-all) viajan intactos.
   The ◇ pill marks a seed actor — only a founder can ever receive one
   (the RPC floors demo actors for everyone else). */
function BellPanel({ bells, onOpen, onMarkAll, onClose }) {
  const rows = bells.signals || []
  /* review v16: un dialog sin manejo de foco es un dialog roto para
     teclado/lector — la trampa de la casa (focusTrap.js) mete el foco,
     lo cicla, maneja Escape y lo DEVUELVE al botón de la campana. */
  const panelRef = useRef(null)
  useFocusTrap(panelRef, onClose)
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 10020 }}>
      {/* el velo — picar afuera cierra */}
      <div className="overlay-fade" onClick={onClose} aria-hidden style={{ position: 'absolute', inset: 0, background: 'rgba(var(--void-rgb),.45)', animation: 'overlayFade .25s var(--ease-exit)' }} />
      {/* el panel — losa de vidrio anclada a la derecha, viewport completo */}
      <div data-testid="bell-block" role="dialog" aria-modal="true" aria-label="The bell — notifications"
        className="panel-in-right" ref={panelRef} tabIndex={-1}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: 'min(92vw, 384px)',
          display: 'flex', flexDirection: 'column',
          ...glassSurface({ borderRadius: 0, border: 'none', borderLeft: '1px solid var(--glass-border)' }),
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '18px 18px 12px', paddingTop: 'calc(18px + env(safe-area-inset-top, 0px))' }}>
          <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '9px', color: SILVER }}>◇</span>
          <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase' }}>
            The bell{bells.unread > 0 ? ` · ${bells.unread} new` : ''}
          </span>
          {bells.unread > 0 && (
            <button className="pressable" data-testid="bell-mark-all" onClick={onMarkAll}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'DM Mono', fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.14em', textTransform: 'uppercase', padding: '4px 2px' }}>
              mark all read
            </button>
          )}
          <button className="pressable" onClick={onClose} aria-label="Close the bell"
            style={{ marginLeft: bells.unread > 0 ? '4px' : 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: BONE_MID, padding: '6px', display: 'inline-flex' }}>
            <X size={15} />
          </button>
        </div>
        {rows.length === 0 && (
          <div style={{ padding: '44px 26px', textAlign: 'center' }}>
            <Bell size={18} strokeWidth={1.4} style={{ color: SILVER, marginBottom: '12px' }} />
            <div style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.6 }}>
              nothing ringing yet — when someone follows you or asks into your circle, it lands here.
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 18px' }}>
        <div style={{ borderRadius: '14px', border: rows.length ? `1px solid ${HAIR}` : 'none', overflow: 'hidden', background: 'rgba(var(--void-rgb),.25)' }}>
        {rows.map((s, i) => {
          const unread = !s.read_at
          const name = s.actor?.name || s.actor?.username || (s.kind === 'ticket_sale' ? 'someone' : 'the room')
          const avatar = safeImg(s.actor?.avatar_url)
          const initial = (name[0] || '◇').toUpperCase()
          return (
            <div key={s.id} data-testid={`bell-row-${s.kind}`} className="pressable" role="button" tabIndex={0}
              onClick={() => onOpen(s)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(s) } }}
              style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 14px', cursor: 'pointer',
                borderTop: i > 0 ? `1px solid ${HAIR}` : 'none', background: unread ? 'rgba(var(--star-rgb),.03)' : 'transparent',
                transition: 'background-color var(--dur-base) var(--ease-house)' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${unread ? SILVER : HAIR_HI}`, background: CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color var(--dur-base) var(--ease-house)' }}>
                {avatar
                  ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontFamily: 'Bebas Neue', fontSize: '15px', color: unread ? BONE : BONE_MID }}>{initial}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', minWidth: 0 }}>
                  <span style={{ fontFamily: 'DM Sans', fontSize: '13px', fontWeight: unread ? 700 : 500, color: unread ? BONE : BONE_MID, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                  <SeedPill is_demo={s.actor?.is_demo} size={7} />
                </div>
                <div style={{ fontFamily: 'DM Sans', fontSize: '12px', color: unread ? BONE_MID : BONE_LOW, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                  {signalLine(s)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em' }}>{msgTime(s.created_at)}</span>
                {/* always mounted so mark-all-read fades the dot out, never teleports it (A-16) */}
                <span aria-hidden style={{ width: '5px', height: '5px', borderRadius: '50%', background: STAR, boxShadow: '0 0 6px rgba(var(--star-rgb),.6)', opacity: unread ? 1 : 0, transition: 'opacity var(--dur-base) var(--ease-house)' }} />
              </div>
            </div>
          )
        })}
        </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* v17 — aquí vivían SegRow (SIGNALS·CREWS·PLANS), CircleBlock y
   FriendRow. Los tabs murieron (una lista); el manejo del círculo
   (requests, roster, close friends) vive en /connections, que ya lo
   tenía completo — esto era un duplicado. */

/* the door rows — START A CREW / MAKE A PLAN, in the inbox row grammar */
function CreateRow({ testid, title, kicker, onGo }) {
  return (
    <button className="row-lead" data-testid={testid} onClick={onGo}
      style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', minHeight: '44px', textAlign: 'left', background: 'transparent', border: 'none', borderTop: `1px solid ${HAIR}`, marginTop: '10px', padding: '14px 2px', cursor: 'pointer' }}>
      <span style={{ width: '42px', height: '42px', borderRadius: '50%', border: `1px dashed ${HAIR_HI}`, background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Mark type="plus" size={14} color={SILVER} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: 'Bebas Neue', fontSize: '19px', color: BONE, letterSpacing: '.02em', lineHeight: 1 }}>{title}</span>
        <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', marginTop: '4px' }}>{kicker}</span>
      </span>
      <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '12px', color: SILVER, flexShrink: 0 }}>→</span>
    </button>
  )
}

function InboxRow({ t, me, last, onOpen }) {
  const title = threadTitle(t)
  const preview = t.lastMessage
    ? `${t.lastMessage.sender_id === me.id ? 'you: ' : ''}${t.lastMessage.body}`
    : 'the room is open — say something'
  const roomKind = isRoomKind(t.kind)
  const face = roomKind ? null : t.others?.[0]
  const avatar = safeImg(face?.avatar_url)
  const kicker = t.kind === 'event' ? 'room' : t.kind === 'group' ? 'crew' : t.kind === 'plan' ? 'plan' : null
  /* v16 — la fila es una CÁPSULA de vidrio con volumen, no una línea con
     hairline (Diego: "transparentes pero planas, y al picarlas no responden").
     Las tres señales de profundidad de la casa (filo especular, piso, sombra
     proyectada) SIN backdrop-filter: una bandeja pinta 10-20 filas y un blur
     por fila es GPU tirada — la translucidez (CARD_TINT) ya deja pasar la
     atmósfera. El press es el resorte (.press-spring): estas filas no llevan
     vidrio real, así que el transform es legal. */
  return (
    <button className="press-spring" onClick={onOpen}
      style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', textAlign: 'left',
        background: CARD_TINT, border: `1px solid ${HAIR_HI}`, borderRadius: '18px',
        boxShadow: 'inset 0 1.5px 0 var(--card-edge), inset 0 -1px 0 var(--glass-floor), var(--card-cast)',
        padding: '13px 14px', marginBottom: last ? 0 : '10px', cursor: 'pointer' }}>
      {/* the face — or the room's mark: calendar for events, square for
          crews, star for plan rooms (Ley 6 / Ley 14) */}
      <span style={{ width: '42px', height: '42px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${t.unread ? SILVER : HAIR_HI}`, background: CARD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {t.kind === 'event'
          ? <CalendarDays size={17} strokeWidth={1.5} style={{ color: SILVER }} />
          : t.kind === 'group'
            ? <Mark type="square" size={15} color={SILVER} />
            : t.kind === 'plan'
              ? <Mark type="star" size={15} color={SILVER} />
              : avatar
                ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontFamily: 'Bebas Neue', fontSize: '18px', color: BONE }}>{(title || '?')[0].toUpperCase()}</span>}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: '19px', color: BONE, letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{title}</span>
          <SeedPill is_demo={face?.is_demo} />
          {kicker && <span style={{ fontFamily: 'DM Mono', fontSize: '7.5px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase', flexShrink: 0 }}>{kicker}</span>}
        </span>
        <span style={{ display: 'block', fontFamily: 'DM Sans', fontSize: '12px', color: t.unread ? BONE_MID : BONE_LOW, lineHeight: 1.4, marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview}</span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em' }}>{relDay(t.last_message_at)}</span>
        {t.unread && <span aria-label="Unread" style={{ width: '6px', height: '6px', borderRadius: '50%', background: STAR, boxShadow: '0 0 8px rgba(var(--star-rgb),.7)' }} />}
      </span>
    </button>
  )
}

function relDay(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date().toDateString()
  if (d.toDateString() === today) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ------------------------------- plans ------------------------------- */

/* the plan's when — moved to src/lib/social.js in v17 (three consumers:
   here, the Events rail, the /p/:id landing). Imported above. */

/* my RSVP applied locally: roster is the source, counts recomputed from
   it — the optimistic card can never show a count the roster contradicts */
function withMyRsvp(p, meId, status) {
  const roster = (p.roster || []).map((r) => (r.id === meId ? { ...r, status } : r))
  return {
    ...p, my_status: status, roster,
    in_count: roster.filter((r) => r.status === 'in').length,
    maybe_count: roster.filter((r) => r.status === 'maybe').length,
    invited_count: roster.filter((r) => r.status === 'invited').length,
  }
}

function PlanCard({ p, meId, onRsvp, onCancel, onLeave, onVisibility, onRoom }) {
  const canceled = p.status === 'canceled'
  const mine = p.creator?.id === meId
  const creatorName = p.creator?.name || (p.creator?.username ? '@' + p.creator.username : null)
  /* v17 — el link compartible. Sólo planes PÚBLICOS lo enseñan (la landing
     /p/:id responde not_found para cualquier otro tier — un link a un
     cuarto invisible es una promesa rota). Cualquier miembro puede
     copiarlo: el caso real es el link del fucho cayendo en un WhatsApp. */
  const [copied, setCopied] = useState(false)
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${p.id}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard denied — the button simply doesn't confirm */ }
  }
  return (
    <div data-testid={`plan-card-${p.id}`}
      style={{ border: `1px solid ${HAIR_HI}`, borderRadius: '14px', padding: '16px 16px 12px', marginBottom: '12px', background: 'linear-gradient(150deg, rgba(var(--star-rgb),.04), rgba(var(--star-rgb),.01))', opacity: canceled ? .55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: BONE, letterSpacing: '.02em', lineHeight: .95 }}>{p.title}</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_MID, letterSpacing: '.1em', marginTop: '7px' }}>
            {(p.spot || 'spot tbd')} · {planWhen(p.starts_at)}
          </div>
        </div>
        {canceled && (
          <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: WARN, letterSpacing: '.2em', textTransform: 'uppercase', border: `1px solid rgba(229,160,160,.3)`, borderRadius: '100px', padding: '4px 10px', flexShrink: 0 }}>canceled</span>
        )}
      </div>

      {p.detail && <div style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.55, marginTop: '8px' }}>{p.detail}</div>}

      {/* real counts only — who's in, who's maybe. no vanity. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.12em', marginTop: '10px' }}>
        <span>{p.in_count || 0} in · {p.maybe_count || 0} maybe{!mine && creatorName ? ` · by ${creatorName}` : ''}</span>
        {!mine && <SeedPill is_demo={p.creator?.is_demo} size={7} />}
      </div>

      {/* who can see it (v9 D2) — the creator edits the tier; a member just
          reads it. The three-tier law of v7, finally visible on the plan. */}
      {!canceled && (
        mine ? (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: '7px' }}>who sees it</div>
            <VisibilityPicker value={p.visibility || 'friends'} onChange={(t) => onVisibility(p.id, t)} compact />
          </div>
        ) : (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '10px', fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase' }}>
            {p.visibility === 'public' ? <Globe size={10} /> : p.visibility === 'close' ? <Star size={10} fill={STAR} color={STAR} /> : <Users size={10} />}
            {VIS_LABEL[p.visibility || 'friends']}
          </div>
        )
      )}

      {/* v17 — the shareable door: public plans carry their own link. Drop
          it in the group chat and it opens for people with no account. */}
      {!canceled && p.visibility === 'public' && (
        <button className="pressable" data-testid="plan-copy-link" onClick={copyLink}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', background: 'rgba(var(--ink-rgb),.05)', border: `1px solid ${HAIR}`, borderRadius: '100px', padding: '6px 12px', color: copied ? BONE : BONE_MID, cursor: 'pointer', fontFamily: 'DM Mono', fontSize: '8.5px', letterSpacing: '.14em', textTransform: 'uppercase' }}>
          {copied ? <Check size={10} /> : <Link2 size={10} />}
          {copied ? 'copied — drop it anywhere' : 'copy the door link'}
        </button>
      )}

      {!canceled && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <RsvpBtn testid="plan-rsvp-in" on={p.my_status === 'in'} label="in" mark="dot" onClick={() => onRsvp(p.id, 'in')} />
          <RsvpBtn testid="plan-rsvp-maybe" on={p.my_status === 'maybe'} label="maybe" mark="ring" onClick={() => onRsvp(p.id, 'maybe')} />
          <RsvpBtn testid="plan-rsvp-out" on={p.my_status === 'out'} label="out" mark="cross" onClick={() => onRsvp(p.id, 'out')} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '12px', borderTop: `1px solid ${HAIR}`, paddingTop: '4px' }}>
        {/* v17: sin onRoom no hay puerta — la tarjeta ya vive DENTRO del
            room y un "the room →" ahí sería una puerta a donde ya estás. */}
        {onRoom && (
          <button className="pressable" data-testid="plan-room-door" onClick={onRoom}
            style={{ background: 'transparent', border: 'none', minHeight: '40px', padding: '10px 2px', color: SILVER, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.16em', textTransform: 'uppercase', cursor: 'pointer' }}>
            the room →
          </button>
        )}
        {mine && !canceled && (
          <button className="pressable" onClick={() => onCancel(p.id)}
            style={{ background: 'transparent', border: 'none', minHeight: '40px', padding: '10px 2px', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '8.5px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
            cancel the plan
          </button>
        )}
        {/* an invitee walks — consent, not a trap; the creator cancels instead */}
        {!mine && !canceled && (
          <button className="pressable" data-testid={`plan-leave-${p.id}`} onClick={() => onLeave(p.id)}
            style={{ background: 'transparent', border: 'none', minHeight: '40px', padding: '10px 2px', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '8.5px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
            leave this plan
          </button>
        )}
      </div>
    </div>
  )
}

function RsvpBtn({ testid, on, label, mark, onClick }) {
  return (
    <button className="pressable" data-testid={testid} onClick={onClick} aria-pressed={on}
      style={{ flex: 1, minHeight: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: on ? 'rgba(var(--ink-rgb),.09)' : 'transparent', border: `1px solid ${on ? 'rgba(var(--ink-rgb),.3)' : HAIR}`, borderRadius: '10px', padding: '10px 8px', color: on ? BONE : BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.18em', textTransform: 'uppercase', cursor: 'pointer', transition: 'background .2s, border-color .2s, color .2s, transform .2s' }}>
      <Mark type={mark} size={10} color={on ? BONE : BONE_LOW} />
      {label}
    </button>
  )
}

/* ------------------------------- sheets -------------------------------
   Bottom sheets in the WorldBuilder grammar: portal to body, z 10000
   (above the tab bar at 9999), void surface, hairline top, grain. */
function Sheet({ label, busy, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [busy, onClose])

  return createPortal(
    <>
      <div onClick={() => { if (!busy) onClose() }} aria-hidden className="overlay-backdrop"
        style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(var(--void-rgb),.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
      <div role="dialog" aria-modal="true" aria-label={label} className="sheet-up-centered"
        style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: '460px', zIndex: 10000, background: VOID, borderTop: `1px solid ${HAIR_HI}`, borderRadius: '18px 18px 0 0', maxHeight: '82dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </>,
    document.body
  )
}

function SheetTop({ kicker, busy, onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 0', position: 'relative' }}>
      <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase' }}>◇ {kicker}</span>
      <button onClick={onClose} disabled={busy} aria-label="Close" style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '4px', display: 'inline-flex', opacity: busy ? .4 : 1 }}><X size={15} /></button>
    </div>
  )
}

const sheetInput = { width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 14px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none' }
const sheetLabel = { fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: BONE_LOW, textTransform: 'uppercase', display: 'block', marginBottom: '7px' }

/* who's coming — the checklist of YOUR connections (the only people a crew or
   plan can be made of; the server enforces the same doctrine) */
function FriendPick({ friends, sel, onToggle, testPrefix, busy }) {
  return (
    <div>
      {friends.map((f, i) => {
        const on = sel.has(f.id)
        const name = f.name || (f.username ? '@' + f.username : 'Member')
        const avatar = safeImg(f.avatar_url)
        return (
          <button key={f.id} type="button" className="pressable" data-testid={`${testPrefix}-${f.id}`} disabled={busy}
            onClick={() => onToggle(f.id)} aria-pressed={on}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', minHeight: '44px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: i === friends.length - 1 ? 'none' : `1px solid ${HAIR}`, padding: '9px 2px', cursor: 'pointer' }}>
            <span style={{ width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${on ? SILVER : HAIR_HI}`, background: CARD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {avatar
                ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontFamily: 'Bebas Neue', fontSize: '13px', color: BONE }}>{(name || '?')[0].toUpperCase()}</span>}
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontFamily: 'DM Sans', fontSize: '13px', color: on ? BONE : BONE_MID, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
              <SeedPill is_demo={f.is_demo} size={7} />
              {f.username && <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em', flexShrink: 0 }}>@{f.username}</span>}
            </span>
            <Mark type="square" size={14} color={on ? BONE : BONE_LOW} filled={on} style={{ flexShrink: 0 }} />
          </button>
        )
      })}
    </div>
  )
}

/* START A CREW — a name, your people, one room */
function CrewSheet({ friends, onClose, onCreated, onGoCommunity }) {
  const [title, setTitle] = useState('')
  const [sel, setSel] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const toggle = (id) => setSel((cur) => { const n = new Set(cur); n.has(id) ? n.delete(id) : n.add(id); return n })
  const canGo = !busy && title.trim().length > 0

  const create = async () => {
    if (!canGo) return
    setBusy(true); setErr('')
    try {
      const threadId = await createCrew(title, [...sel])
      onCreated(threadId)
    } catch (e) { setErr(e?.message || "couldn't open the room — try again"); setBusy(false) }
  }

  return (
    <Sheet label="Start a crew" busy={busy} onClose={onClose}>
      <SheetTop kicker="start a crew" busy={busy} onClose={onClose} />
      <div className="no-scrollbar" style={{ padding: '12px 20px calc(20px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto', position: 'relative', flex: 1, minHeight: 0 }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '27px', lineHeight: .95, color: BONE }}>YOUR PEOPLE, ONE ROOM</div>
        <p style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.55, margin: '8px 0 16px' }}>
          A crew is a group chat that stays — name it and bring your connections.
        </p>
        <label htmlFor="crew-title" style={sheetLabel}>THE NAME</label>
        <input id="crew-title" data-testid="crew-title-input" value={title} maxLength={60} disabled={busy}
          placeholder="los del sábado" autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && canGo) create() }}
          style={sheetInput} />
        <div style={{ marginTop: '16px' }}>
          <label style={sheetLabel}>WHO'S IN <span style={{ opacity: .6 }}>· your connections</span></label>
          {friends.length ? (
            <FriendPick friends={friends} sel={sel} onToggle={toggle} testPrefix="crew-friend" busy={busy} />
          ) : (
            <div style={{ padding: '14px 0 4px' }}>
              <p style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.6, margin: 0 }}>
                a crew is made of your people — add connections from their worlds first.
              </p>
              <button className="pressable" onClick={onGoCommunity}
                style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', minHeight: '40px', padding: '10px 18px', color: BONE_MID, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
                find your people <ArrowUpRight size={12} />
              </button>
            </div>
          )}
        </div>
        {err && <div role="alert" style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '12px' }}>⚠ {err}</div>}
        <button className="pressable" onClick={create} disabled={!canGo}
          style={{ marginTop: '16px', width: '100%', minHeight: '46px', background: BONE, border: 'none', borderRadius: '10px', padding: '14px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: canGo ? 'pointer' : 'default', fontFamily: 'DM Sans', opacity: canGo ? 1 : .5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {busy ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> OPENING…</> : 'OPEN THE ROOM'}
        </button>
      </div>
    </Sheet>
  )
}

/* WHO CAN SEE IT — the three tiers of v7 D5, finally a control (v9 D2).
   PÚBLICO / CONNECTIONS / CLOSE FRIENDS, default connections. A lit star means close
   (Ley 14 — light with meaning). Reused at create and on the plan card. */
const VIS_META = {
  public: { icon: Globe, sub: 'anyone can find it' },
  friends: { icon: Users, sub: 'your connections' },
  close: { icon: Star, sub: 'your close friends only' },
}
function VisibilityPicker({ value, onChange, disabled, compact }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {VIS_TIERS.map((t) => {
          const on = value === t
          const Icon = VIS_META[t].icon
          return (
            <button key={t} type="button" className="pressable" data-testid={`plan-vis-${t}`} disabled={disabled}
              onClick={() => onChange(t)} aria-pressed={on}
              style={{ flex: 1, minHeight: compact ? '36px' : '46px', display: 'inline-flex', flexDirection: compact ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: compact ? '5px' : '5px', background: on ? 'rgba(var(--ink-rgb),.09)' : 'transparent', border: `1px solid ${on ? 'rgba(var(--ink-rgb),.3)' : HAIR}`, borderRadius: '10px', padding: compact ? '8px 6px' : '10px 6px', color: on ? BONE : BONE_LOW, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .6 : 1, transition: 'background .2s, border-color .2s, color .2s, opacity .2s, transform .2s' }}>
              <Icon size={compact ? 11 : 14} strokeWidth={1.6} fill={t === 'close' && on ? STAR : 'none'} color={on ? (t === 'close' ? STAR : BONE) : BONE_LOW} />
              <span style={{ fontFamily: 'DM Mono', fontSize: compact ? '8px' : '8.5px', letterSpacing: '.1em', textTransform: 'uppercase' }}>{VIS_LABEL[t]}</span>
            </button>
          )
        })}
      </div>
      {!compact && (
        <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.1em', marginTop: '7px' }}>
          {VIS_META[value]?.sub}
        </div>
      )}
    </div>
  )
}

/* MAKE A PLAN — what / where / when + your people. TBD is honest. */
function PlanSheet({ friends, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [spot, setSpot] = useState('')
  const [when, setWhen] = useState('')
  const [detail, setDetail] = useState('')
  const [sel, setSel] = useState(() => new Set())
  const [vis, setVis] = useState('friends')   // v9 D2 — default connections (0029)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const toggle = (id) => setSel((cur) => { const n = new Set(cur); n.has(id) ? n.delete(id) : n.add(id); return n })
  const canGo = !busy && title.trim().length > 0

  const create = async () => {
    if (!canGo) return
    setBusy(true); setErr('')
    try {
      const startsAt = when && !isNaN(new Date(when)) ? new Date(when).toISOString() : null
      const { plan_id, thread_id } = await createPlan({ title, spot, detail, startsAt, inviteeIds: [...sel] })
      // the plan (and its room) now EXIST at the default 'friends'. Setting a
      // non-default tier is a best-effort SECOND step — a blip there must NOT
      // report "couldn't make the plan" (it was made) nor strand the sheet open
      // and invite a duplicating retry (review catch). The creator adjusts the
      // tier on the plan card if this misses.
      if (vis !== 'friends' && plan_id) {
        try { await setPlanVisibility(plan_id, vis) } catch { /* non-fatal — plan lives at 'friends' */ }
      }
      onCreated(plan_id, thread_id)
    } catch (e) { setErr(e?.message || "couldn't make the plan — try again"); setBusy(false) }
  }

  return (
    <Sheet label="Make a plan" busy={busy} onClose={onClose}>
      <SheetTop kicker="make a plan" busy={busy} onClose={onClose} />
      <div className="no-scrollbar" style={{ padding: '12px 20px calc(20px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto', position: 'relative', flex: 1, minHeight: 0 }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '27px', lineHeight: .95, color: BONE }}>WHAT, WHERE, WHEN</div>
        <p style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.55, margin: '8px 0 16px' }}>
          A kickback, a roadtrip, fucho on saturday — the plan gets its own room, your connections get the door.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label htmlFor="plan-title" style={sheetLabel}>THE PLAN</label>
            <input id="plan-title" data-testid="plan-title-input" value={title} maxLength={80} disabled={busy}
              placeholder="fucho on saturday" autoFocus
              onChange={(e) => setTitle(e.target.value)} style={sheetInput} />
          </div>
          <div>
            <label htmlFor="plan-spot" style={sheetLabel}>THE SPOT <span style={{ opacity: .6 }}>· optional</span></label>
            <input id="plan-spot" value={spot} maxLength={120} disabled={busy}
              placeholder="the park on Eleanor, mi casa, tbd"
              onChange={(e) => setSpot(e.target.value)} style={sheetInput} />
          </div>
          <div>
            <label htmlFor="plan-when" style={sheetLabel}>WHEN <span style={{ opacity: .6 }}>· optional — tbd is honest</span></label>
            <input id="plan-when" type="datetime-local" value={when} disabled={busy}
              onChange={(e) => setWhen(e.target.value)}
              style={{ ...sheetInput, colorScheme: 'dark', fontFamily: 'DM Mono', fontSize: '12px' }} />
          </div>
          <div>
            <label htmlFor="plan-detail" style={sheetLabel}>THE DETAILS <span style={{ opacity: .6 }}>· optional</span></label>
            <textarea id="plan-detail" value={detail} maxLength={500} rows={2} disabled={busy}
              placeholder="bring a ball. loser buys tacos."
              onChange={(e) => setDetail(e.target.value)}
              style={{ ...sheetInput, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <label style={sheetLabel}>WHO'S INVITED <span style={{ opacity: .6 }}>· your connections</span></label>
            {friends.length ? (
              <FriendPick friends={friends} sel={sel} onToggle={toggle} testPrefix="plan-friend" busy={busy} />
            ) : (
              <p style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.6, margin: '4px 0 0' }}>
                your connections will show here — add them from their worlds. the plan can start with just you.
              </p>
            )}
          </div>
          {/* v9 D2 — who can see it: the three-tier law of v7, finally a control */}
          <div>
            <label style={sheetLabel}>WHO CAN SEE IT</label>
            <VisibilityPicker value={vis} onChange={setVis} disabled={busy} />
          </div>
        </div>
        {err && <div role="alert" style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '12px' }}>⚠ {err}</div>}
        <button className="pressable" onClick={create} disabled={!canGo}
          style={{ marginTop: '16px', width: '100%', minHeight: '46px', background: BONE, border: 'none', borderRadius: '10px', padding: '14px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: canGo ? 'pointer' : 'default', fontFamily: 'DM Sans', opacity: canGo ? 1 : .5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {busy ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> MAKING IT…</> : 'MAKE IT REAL'}
        </button>
      </div>
    </Sheet>
  )
}

/* ------------------------------- thread ------------------------------- */
function Thread({ threadId, me, wide }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [thread, setThread] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState(() => location.state?.prefill || '')
  const [sending, setSending] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [err, setErr] = useState('')
  const bottomRef = useRef(null)
  const profilesRef = useRef({})
  // this transcript is HISTORY, not news: only a message that arrives AFTER the
  // thread's history has loaded animates. prevLen tracks what's already on
  // screen; it's advanced to the loaded length in load() (below), so opening a
  // thread — or switching threads — animates nothing. Same "history is not
  // news" pattern as plan 004's Brain dock, adapted for async-loaded state.
  const prevLen = useRef(msgs.length)
  useEffect(() => { prevLen.current = msgs.length }, [msgs.length])

  const load = useCallback(async () => {
    const t = await fetchThread(threadId, me.id)
    if (!t) { setLoading(false); setThread(null); return }
    profilesRef.current = Object.fromEntries((t.members || []).map((p) => [p.id, p]))
    setThread(t)
    setMsgs(t.messages)
    prevLen.current = t.messages.length   // history just landed — it is old, never animate it
    setLoading(false)
    markThreadRead(threadId, me.id)
    markThreadSignalsRead(threadId)   // reading the room IS reading the bell (0043)
  }, [threadId, me.id])

  useEffect(() => { load() }, [load])

  // live: new messages arrive without a reload; RLS gates the stream.
  // Only OTHERS' messages move the read cursor — your own echo already
  // did at send time (write-amplification catch).
  useEffect(() => {
    const off = subscribeThread(threadId, (m) => {
      setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]))
      if (m.sender_id !== me.id) { markThreadRead(threadId, me.id); markThreadSignalsRead(threadId) }
    })
    return off
  }, [threadId, me.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true); setErr('')
    try {
      const m = await sendMessage(threadId, me.id, body)
      setText('')
      if (m) setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]))
    } catch (e) {
      setErr(e?.message || "couldn't send — try again")
    } finally { setSending(false) }
  }

  /* v17 — EL ROOM DEL PLAN CARGA SU PLAN. Los tabs murieron y con ellos la
     lista de PlanCards: gestionar el plan (RSVP, quién lo ve, el link de
     la puerta, cancelar/salir) pasa AQUÍ, en el cuarto del plan — a un tap
     de la lista, nunca en un tab que nadie podía explicar. myPlans() sólo
     se pide cuando el thread ES de plan. */
  const [plan, setPlan] = useState(null)
  const [planErr, setPlanErr] = useState('')
  useEffect(() => {
    if (thread?.kind !== 'plan') { setPlan(null); return undefined }
    let alive = true
    myPlans().then((ps) => { if (alive) setPlan(ps.find((p) => p.thread_id === threadId) || null) })
    return () => { alive = false }
  }, [thread?.kind, threadId])

  // the plan handlers, single-card edition — optimistic + honest rollback,
  // same discipline the old tab had (Ley 11)
  const planRsvp = async (planId, status) => {
    const prev = plan
    setPlanErr('')
    setPlan((p) => (p ? withMyRsvp(p, me.id, status) : p))
    try { await rsvpPlan(planId, status) }
    catch (e) { setPlan(prev); setPlanErr(e?.message || "couldn't answer — try again") }
  }
  const planCancel = async (planId) => {
    if (!window.confirm('Cancel this plan? Everyone in it sees it canceled — the room stays open.')) return
    setPlanErr('')
    try { await cancelPlan(planId); setPlan((p) => (p ? { ...p, status: 'canceled' } : p)) }
    catch (e) { setPlanErr(e?.message || "couldn't cancel — try again") }
  }
  const planLeave = async (planId) => {
    if (!window.confirm('Leave this plan? You leave its room with it.')) return
    setPlanErr('')
    // leave_plan (0026) removes you from the plan AND its thread — the room
    // is no longer yours to stand in, so the exit lands on the list
    try { await leavePlan(planId); navigate('/messages') }
    catch (e) { setPlanErr(e?.message || "couldn't leave — try again") }
  }
  const planVisibility = async (planId, tier) => {
    const prevTier = plan?.visibility
    setPlanErr('')
    setPlan((p) => (p ? { ...p, visibility: tier } : p))
    try { await setPlanVisibility(planId, tier) }
    catch (e) {
      setPlan((p) => (p ? { ...p, visibility: prevTier } : p))
      setPlanErr(e?.message || "couldn't change who sees it — try again")
    }
  }

  // walk out of a crew — the room continues without you (groups only)
  const leave = async () => {
    if (leaving) return
    if (!window.confirm('Leave this crew? The room continues without you.')) return
    setLeaving(true); setErr('')
    try {
      await leaveCrew(threadId)
      navigate('/messages')
    } catch (e) { setErr(e?.message || "couldn't leave — try again"); setLeaving(false) }
  }

  if (loading) return (
    <Shell wide={wide}>
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
      </div>
    </Shell>
  )

  // not a member / gone: honest, and a way back (Leyes 9, 11)
  if (!thread) return (
    <Shell wide={wide}>
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center' }}>
        <Lock size={22} strokeWidth={1.2} style={{ color: BONE_LOW, marginBottom: '18px' }} />
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '26px', color: BONE, letterSpacing: '.02em', marginBottom: '8px' }}>THIS CONVERSATION ISN'T YOURS TO OPEN</div>
        <div style={{ fontSize: '13px', color: BONE_MID, marginBottom: '24px', lineHeight: 1.6, fontFamily: 'DM Sans' }}>Threads open only for the people in them.</div>
        <button className="pressable" onClick={() => navigate('/messages')} style={{ background: 'rgba(var(--ink-rgb),.06)', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '10px 20px', color: BONE_MID, fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
          ← Messages
        </button>
      </div>
    </Shell>
  )

  const title = threadTitle(thread)
  const other = thread.kind === 'dm' ? thread.others?.[0] : null
  // v17: one list — every way back is the same door
  const backTo = '/messages'

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', display: 'flex', flexDirection: 'column' }}>
      {/* the sky is the app's shared atmosphere (v8 D2) — QUIET register:
          where people read each other, the galaxy shuts up */}

      {/* header — who this room is (tap the name: their world / the event) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(var(--void-rgb),.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: wide ? '720px' : undefined, margin: wide ? '0 auto' : undefined, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="pressable" onClick={() => navigate(backTo)} aria-label="Back to Messages" style={{ background: 'transparent', border: 'none', color: BONE, cursor: 'pointer', display: 'inline-flex', padding: '4px' }}>
            <ArrowLeft size={17} />
          </button>
          <button
            onClick={() => {
              if (other?.id) navigate('/user/' + other.id)
              else if (thread.event?.slug) navigate('/e/' + thread.event.slug)
            }}
            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '11px', background: 'transparent', border: 'none', padding: 0, cursor: (other?.id || thread.event?.slug) ? 'pointer' : 'default', textAlign: 'left' }}>
            <span style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: CARD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {thread.kind === 'event'
                ? <CalendarDays size={14} strokeWidth={1.5} style={{ color: SILVER }} />
                : thread.kind === 'group'
                  ? <Mark type="square" size={13} color={SILVER} />
                  : thread.kind === 'plan'
                    ? <Mark type="star" size={13} color={SILVER} />
                    : safeImg(other?.avatar_url)
                      ? <img src={other.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontFamily: 'Bebas Neue', fontSize: '14px', color: BONE }}>{(title || '?')[0].toUpperCase()}</span>}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                <span style={{ fontFamily: 'Bebas Neue', fontSize: '17px', color: BONE, letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{title}</span>
                {thread.kind === 'dm' && <SeedPill is_demo={other?.is_demo} size={7} />}
              </span>
              <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: '3px' }}>
                {thread.kind === 'event' ? `the room · ${thread.members.length} in`
                  : thread.kind === 'group' ? `the crew · ${thread.members.length} inside`
                    : thread.kind === 'plan' ? "the plan's room"
                      : (other?.username ? '@' + other.username : 'direct')}
              </span>
            </span>
          </button>
          {thread.kind === 'group' && (
            <button className="pressable" onClick={leave} disabled={leaving} aria-label="Leave this crew"
              style={{ background: 'transparent', border: `1px solid ${HAIR}`, borderRadius: '100px', minHeight: '40px', padding: '11px 16px', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '8.5px', letterSpacing: '.16em', textTransform: 'uppercase', cursor: leaving ? 'default' : 'pointer', opacity: leaving ? .5 : 1, flexShrink: 0 }}>
              {leaving ? '…' : 'leave'}
            </button>
          )}
        </div>
      </div>

      {/* the conversation */}
      <div style={{ position: 'relative', zIndex: 2, flex: 1, width: '100%', maxWidth: wide ? '720px' : undefined, margin: wide ? '0 auto' : undefined, padding: '18px 18px 150px' }}>
        {/* v17 — the plan lives at the top of its own room: what/where/when,
            RSVP, visibility, the shareable door link. onRoom is moot here
            (you're standing in it) — it stays undefined and the card's room
            door simply doesn't render. */}
        {thread.kind === 'plan' && plan && (
          <div style={{ marginBottom: '16px' }}>
            <PlanCard p={plan} meId={me.id}
              onRsvp={planRsvp} onCancel={planCancel} onLeave={planLeave} onVisibility={planVisibility} />
            {planErr && <div role="alert" style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '6px' }}>⚠ {planErr}</div>}
          </div>
        )}
        {msgs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '46px 20px' }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ the room is open</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: BONE, marginTop: '10px' }}>SAY THE FIRST THING</div>
          </div>
        ) : (
          <div role="log" aria-live="polite" aria-label="Messages" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {msgs.map((m, idx) => {
              const mine = m.sender_id === me.id
              const sender = profilesRef.current[m.sender_id]
              return (
                <div key={m.id} className={idx >= prevLen.current ? 'msg-in' : ''} style={{ display: 'flex', gap: '10px', flexDirection: mine ? 'row-reverse' : 'row' }}>
                  {!mine && (
                    <span style={{ width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: CARD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      {safeImg(sender?.avatar_url)
                        ? <img src={sender.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontFamily: 'Bebas Neue', fontSize: '11px', color: BONE }}>{(sender?.full_name || '?')[0].toUpperCase()}</span>}
                    </span>
                  )}
                  <div style={{ maxWidth: '78%', background: mine ? 'rgba(var(--ink-rgb),.07)' : CARD, border: `1px solid ${mine ? 'rgba(var(--ink-rgb),.14)' : HAIR}`, borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '10px 14px' }}>
                    {/* v12: en una sala con varias personas, el nombre sobre
                        cada mensaje es puerta a su mundo. Es EL sitio donde a
                        alguien le dan ganas de saber quién es el que habla, y
                        era texto muerto. Sólo cuando hay id — un renglón sin
                        perfil detrás no finge ser puerta (Ley 9). */}
                    {!mine && isRoomKind(thread.kind) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Mono', fontSize: '9px', color: SILVER, letterSpacing: '.08em', marginBottom: '4px' }}>
                        {m.sender_id ? (
                          <button className="pressable" onClick={() => navigate(`/user/${m.sender_id}`)}
                            aria-label={`Open ${sender?.full_name || 'this member'}'s world`}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                              font: 'inherit', color: 'inherit', letterSpacing: 'inherit' }}>
                            {sender?.full_name || sender?.username || 'Member'}
                          </button>
                        ) : (
                          <span>{sender?.full_name || sender?.username || 'Member'}</span>
                        )}
                        <SeedPill is_demo={sender?.is_demo} size={7} />
                      </div>
                    )}
                    {/* .selectable: el shell global apaga la selección de texto
                        en toda la app (v11) — el cuerpo de un mensaje es
                        justamente donde el usuario SÍ necesita mantener
                        presionado para copiar. */}
                    <div className="selectable" style={{ fontSize: '13.5px', color: BONE, lineHeight: 1.55, fontFamily: 'DM Sans', overflowWrap: 'anywhere' }}>{m.body}</div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, marginTop: '5px', textAlign: mine ? 'right' : 'left', letterSpacing: '.06em' }}>{msgTime(m.created_at)}</div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
        {err && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '12px', textAlign: 'center' }}>⚠ {err}</div>}
      </div>

      {/* the composer — fixed ABOVE the tab bar, not behind it. v11: it used to
          sit at bottom:0 and reserve the bar's height as padding, which meant
          its opaque background ran underneath the bar. That was invisible when
          the bar was opaque; against glass it would back the slab with a dead
          slab of its own instead of the live conversation. So it now ENDS where
          the bar's runway begins and the messages scroll through the gap.
          112px tracks Layout's runway — if GlassNav's DOCK_BOTTOM moves, both
          move with it. */}
      <div style={{ position: 'fixed', bottom: 'calc(98px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0, zIndex: 9998, background: 'rgba(var(--void-rgb),.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: `1px solid ${HAIR}`, padding: '10px 18px 12px' }}>
        <div style={{ maxWidth: wide ? '720px' : '430px', margin: '0 auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text" value={text} placeholder="Say something…" maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            style={{ flex: 1, background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '12px 18px', color: BONE, fontFamily: 'DM Sans', fontSize: '13px', outline: 'none' }} />
          <button className="pressable" onClick={send} disabled={!text.trim() || sending} aria-label="Send"
            style={{ width: '42px', height: '42px', borderRadius: '50%', background: text.trim() ? BONE : 'rgba(var(--ink-rgb),.06)', border: 'none', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s', flexShrink: 0 }}>
            {sending
              ? <Loader2 size={14} style={{ color: text.trim() ? VOID : BONE_LOW, animation: 'spin 1s linear infinite' }} />
              : <Send size={14} style={{ color: text.trim() ? VOID : BONE_LOW }} />}
          </button>
        </div>
      </div>

    </div>
  )
}

/* ------------------------------ chrome ------------------------------ */
function Shell({ children, wide }) {
  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', overflowX: 'hidden' }}>
      {/* quiet register of the shared atmosphere — grain and a far star */}
      <div style={{ position: 'relative', zIndex: 2, padding: wide ? '34px clamp(40px, 5vw, 76px) 70px' : '22px 22px 40px', maxWidth: wide ? '1440px' : undefined, margin: wide ? '0 auto' : undefined }}>
        {children}
      </div>
    </div>
  )
}

function Header({ wide, count, bellUnread = 0, onBell }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: SILVER, letterSpacing: '.28em', paddingBottom: '8px' }}>△</div>
        <div>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: wide ? '.34em' : '.28em', textTransform: 'uppercase', marginBottom: '4px' }}>The conversations continue</div>
          <h1 style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '58px' : '40px', letterSpacing: '.02em', lineHeight: .85, margin: 0, ...chromeText }}>MESSAGES</h1>
        </div>
      </div>
      {count != null && (
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', paddingBottom: wide ? '7px' : '5px' }}>
          {String(count).padStart(2, '0')} open
        </div>
      )}
      {/* v16 — LA CAMPANA: el panel de notificaciones vive detrás de este
          control (arriba a la derecha, como pidió el send-off). glassControl:
          flota directo sobre la página, sin cardGlass arriba — la regla de
          no-anidar se respeta. El badge dice la verdad de signals_unread y
          nunca inventa. */
      }
      {onBell && (
        <button className="glass-press" data-testid="bell-door" onClick={onBell}
          aria-label={bellUnread > 0 ? `The bell — ${bellUnread} unread` : 'The bell — notifications'}
          style={{
            ...glassControl(),
            marginLeft: 'auto', alignSelf: 'flex-end', marginBottom: wide ? '2px' : 0,
            position: 'relative', width: '40px', height: '40px', borderRadius: '50%',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: BONE, cursor: 'pointer',
          }}>
          <Bell size={16} strokeWidth={1.5} />
          {bellUnread > 0 && (
            <span data-testid="bell-door-badge" aria-hidden
              style={{ position: 'absolute', top: '-3px', right: '-3px', minWidth: '15px', height: '15px',
                borderRadius: '100px', background: BONE, color: 'var(--bg)', fontFamily: 'DM Mono',
                fontSize: '8.5px', fontWeight: 700, lineHeight: '15px', textAlign: 'center', padding: '0 3px',
                boxShadow: '0 0 0 2px rgba(var(--void-rgb),0.55)' }}>
              {bellUnread > 9 ? '9+' : bellUnread}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
