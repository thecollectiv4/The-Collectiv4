import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { useWide } from '@/lib/useIsDesktop'
import Constellation from '@/components/Constellation'
import AuthResolving from '@/components/AuthResolving'
import { socialReady, fetchInbox, fetchThread, sendMessage, markThreadRead, subscribeThread, msgTime } from '@/lib/social'
import { Loader2, Send, ArrowLeft, Lock, MessagesSquare, CalendarDays, ArrowUpRight } from 'lucide-react'

/* =========================================================================
   MESSAGES — the conversations that continue (D2: the Base44 chat rebuilt
   native). One surface, two registers:
     /messages      → the inbox: every thread you belong to, newest first
     /messages/:id  → the thread: a DM pair or an event's room

   RLS is the wall: participants-only reads/writes (migration 0017), and
   the stream respects it too. Ley 6: names and faces lead every row.
   Ley 11: pre-migration this page says the wires are going in — no dead
   composer, no fake inbox. Ley 14: starlight — the quiet channel.
   ========================================================================= */

const VOID = '#0A0A0D'
const VOID_2 = '#07080E'
const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const SILVER = '#C7C9D1'
const STAR = '#E8E9ED'
const CARD = '#0E0E13'
const HAIR = 'rgba(242,238,230,0.08)'
const HAIR_HI = 'rgba(242,238,230,0.15)'
const WARN = '#E5A0A0'
const CHROME = 'linear-gradient(176deg,#EEF0F4 0%,#BFC2CB 20%,#83868F 40%,#F7F9FD 52%,#7E818A 63%,#CED1DA 82%,#9497A0 100%)'
const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }
const NOISE = "<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(NOISE)}")`

const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''

const threadTitle = (t) => {
  if (t.kind === 'event') {
    const e = t.event
    return e ? `${e.title}${e.edition ? ' · ' + e.edition : ''}` : 'Event room'
  }
  const o = t.others?.[0]
  return o?.full_name || (o?.username ? '@' + o.username : 'Member')
}

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
        <button className="pressable" onClick={() => navigate('/auth')} style={{ background: BONE, border: 'none', borderRadius: '10px', padding: '14px 36px', color: VOID, fontFamily: 'DM Sans', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Sign in</button>
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
      <div style={{ marginTop: '22px', padding: '42px 26px', borderRadius: '18px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(232,233,237,.05), rgba(232,233,237,.01))', textAlign: 'center' }}>
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
  const [loading, setLoading] = useState(true)
  const [threads, setThreads] = useState([])

  useEffect(() => {
    let alive = true
    fetchInbox(me.id).then((rows) => { if (alive) { setThreads(rows); setLoading(false) } })
    return () => { alive = false }
  }, [me.id])

  return (
    <Shell wide={wide}>
      <Header wide={wide} count={loading ? null : threads.length} />
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
        </div>
      ) : threads.length === 0 ? (
        <div style={{ marginTop: '22px', padding: '42px 26px', borderRadius: '18px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(232,233,237,.05), rgba(232,233,237,.01))', textAlign: 'center' }}>
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
        <div style={{ marginTop: '14px', maxWidth: wide ? '720px' : undefined }}>
          {threads.map((t, i) => (
            <InboxRow key={t.id} t={t} me={me} last={i === threads.length - 1} onOpen={() => navigate('/messages/' + t.id)} />
          ))}
        </div>
      )}
    </Shell>
  )
}

function InboxRow({ t, me, last, onOpen }) {
  const title = threadTitle(t)
  const preview = t.lastMessage
    ? `${t.lastMessage.sender_id === me.id ? 'you: ' : ''}${t.lastMessage.body}`
    : 'the room is open — say something'
  const face = t.kind === 'event' ? null : t.others?.[0]
  const avatar = safeImg(face?.avatar_url)
  return (
    <button className="pressable" onClick={onOpen}
      style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: last ? 'none' : `1px solid ${HAIR}`, padding: '14px 2px', cursor: 'pointer', transition: 'padding-left .2s ease' }}
      onMouseOver={(e) => { e.currentTarget.style.paddingLeft = '10px' }}
      onMouseOut={(e) => { e.currentTarget.style.paddingLeft = '2px' }}>
      {/* the face — or the room mark for event threads (Ley 6) */}
      <span style={{ width: '42px', height: '42px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${t.unread ? SILVER : HAIR_HI}`, background: CARD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {t.kind === 'event'
          ? <CalendarDays size={17} strokeWidth={1.5} style={{ color: SILVER }} />
          : avatar
            ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontFamily: 'Bebas Neue', fontSize: '18px', color: BONE }}>{(title || '?')[0].toUpperCase()}</span>}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: '19px', color: BONE, letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{title}</span>
          {t.kind === 'event' && <span style={{ fontFamily: 'DM Mono', fontSize: '7.5px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase', flexShrink: 0 }}>room</span>}
        </span>
        <span style={{ display: 'block', fontFamily: 'DM Sans', fontSize: '12px', color: t.unread ? BONE_MID : BONE_LOW, lineHeight: 1.4, marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview}</span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em' }}>{relDay(t.last_message_at)}</span>
        {t.unread && <span aria-label="Unread" style={{ width: '6px', height: '6px', borderRadius: '50%', background: STAR, boxShadow: '0 0 8px rgba(232,233,237,.7)' }} />}
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

/* ------------------------------- thread ------------------------------- */
function Thread({ threadId, me, wide }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [thread, setThread] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState(() => location.state?.prefill || '')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const bottomRef = useRef(null)
  const profilesRef = useRef({})

  const load = useCallback(async () => {
    const t = await fetchThread(threadId, me.id)
    if (!t) { setLoading(false); setThread(null); return }
    profilesRef.current = Object.fromEntries((t.members || []).map((p) => [p.id, p]))
    setThread(t)
    setMsgs(t.messages)
    setLoading(false)
    markThreadRead(threadId, me.id)
  }, [threadId, me.id])

  useEffect(() => { load() }, [load])

  // live: new messages arrive without a reload; RLS gates the stream
  useEffect(() => {
    const off = subscribeThread(threadId, (m) => {
      setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]))
      markThreadRead(threadId, me.id)
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
        <button className="pressable" onClick={() => navigate('/messages')} style={{ background: 'rgba(242,238,230,.06)', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '10px 20px', color: BONE_MID, fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
          ← Messages
        </button>
      </div>
    </Shell>
  )

  const title = threadTitle(thread)
  const other = thread.kind === 'dm' ? thread.others?.[0] : null

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', display: 'flex', flexDirection: 'column' }}>
      <Constellation seed={`thread-${threadId}`} quiet tint="232,233,237" />

      {/* header — who this room is (tap the name: their world / the event) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(10,10,13,.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: wide ? '720px' : undefined, margin: wide ? '0 auto' : undefined, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="pressable" onClick={() => navigate('/messages')} aria-label="Back to Messages" style={{ background: 'transparent', border: 'none', color: BONE, cursor: 'pointer', display: 'inline-flex', padding: '4px' }}>
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
                : safeImg(other?.avatar_url)
                  ? <img src={other.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontFamily: 'Bebas Neue', fontSize: '14px', color: BONE }}>{(title || '?')[0].toUpperCase()}</span>}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: 'Bebas Neue', fontSize: '17px', color: BONE, letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
              <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: '3px' }}>
                {thread.kind === 'event' ? `the room · ${thread.members.length} in` : (other?.username ? '@' + other.username : 'direct')}
              </span>
            </span>
          </button>
        </div>
      </div>

      {/* the conversation */}
      <div style={{ position: 'relative', zIndex: 2, flex: 1, width: '100%', maxWidth: wide ? '720px' : undefined, margin: wide ? '0 auto' : undefined, padding: '18px 18px 150px' }}>
        {msgs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '46px 20px' }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ the room is open</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: BONE, marginTop: '10px' }}>SAY THE FIRST THING</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {msgs.map((m) => {
              const mine = m.sender_id === me.id
              const sender = profilesRef.current[m.sender_id]
              return (
                <div key={m.id} style={{ display: 'flex', gap: '10px', flexDirection: mine ? 'row-reverse' : 'row' }}>
                  {!mine && (
                    <span style={{ width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: CARD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      {safeImg(sender?.avatar_url)
                        ? <img src={sender.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontFamily: 'Bebas Neue', fontSize: '11px', color: BONE }}>{(sender?.full_name || '?')[0].toUpperCase()}</span>}
                    </span>
                  )}
                  <div style={{ maxWidth: '78%', background: mine ? 'rgba(242,238,230,.07)' : CARD, border: `1px solid ${mine ? 'rgba(242,238,230,.14)' : HAIR}`, borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '10px 14px' }}>
                    {!mine && thread.kind === 'event' && (
                      <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: SILVER, letterSpacing: '.08em', marginBottom: '4px' }}>{sender?.full_name || sender?.username || 'Member'}</div>
                    )}
                    <div style={{ fontSize: '13.5px', color: BONE, lineHeight: 1.55, fontFamily: 'DM Sans', overflowWrap: 'anywhere' }}>{m.body}</div>
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

      {/* the composer — fixed above the tab bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998, background: 'rgba(10,10,13,.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: `1px solid ${HAIR}`, padding: '10px 18px calc(84px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ maxWidth: wide ? '720px' : '430px', margin: '0 auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text" value={text} placeholder="Say something…" maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            style={{ flex: 1, background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '12px 18px', color: BONE, fontFamily: 'DM Sans', fontSize: '13px', outline: 'none' }} />
          <button className="pressable" onClick={send} disabled={!text.trim() || sending} aria-label="Send"
            style={{ width: '42px', height: '42px', borderRadius: '50%', background: text.trim() ? BONE : 'rgba(242,238,230,.06)', border: 'none', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s', flexShrink: 0 }}>
            {sending
              ? <Loader2 size={14} style={{ color: text.trim() ? VOID : BONE_LOW, animation: 'spin 1s linear infinite' }} />
              : <Send size={14} style={{ color: text.trim() ? VOID : BONE_LOW }} />}
          </button>
        </div>
      </div>

      <div style={{ position: 'absolute', inset: 0, background: GRAIN, backgroundSize: '150px 150px', opacity: 0.04, mixBlendMode: 'overlay', pointerEvents: 'none', zIndex: 5 }} />
    </div>
  )
}

/* ------------------------------ chrome ------------------------------ */
function Shell({ children, wide }) {
  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', overflowX: 'hidden' }}>
      <Constellation seed="the-conversations" quiet tint="232,233,237" />
      <div style={{ position: 'relative', zIndex: 2, padding: wide ? '34px clamp(40px, 5vw, 76px) 70px' : '22px 22px 40px', maxWidth: wide ? '1440px' : undefined, margin: wide ? '0 auto' : undefined }}>
        {children}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: GRAIN, backgroundSize: '150px 150px', opacity: 0.04, mixBlendMode: 'overlay', pointerEvents: 'none', zIndex: 20 }} />
    </div>
  )
}

function Header({ wide, count }) {
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
    </div>
  )
}
