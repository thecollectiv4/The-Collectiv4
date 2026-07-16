import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { useWide } from '@/lib/useIsDesktop'
import AuthResolving from '@/components/AuthResolving'
import Mark from '@/components/Mark'
import {
  socialReady, circleReady, fetchInbox, fetchThread, sendMessage, markThreadRead, subscribeThread, msgTime,
  myCircle, respondFriend, createCrew, leaveCrew, createPlan, rsvpPlan, cancelPlan, leavePlan, myPlans,
  addCloseFriend, removeCloseFriend, myCloseFriends,
  setPlanVisibility, VIS_TIERS, VIS_LABEL,
} from '@/lib/social'
import { fetchCraftsForProfiles, categoryMeta } from '@/lib/crafts'
import PeopleSearch from '@/components/PeopleSearch'
import { Loader2, Send, ArrowLeft, Lock, MessagesSquare, CalendarDays, ArrowUpRight, X, Star, Globe, Users } from 'lucide-react'

/* =========================================================================
   MESSAGES — the conversations that continue (D2: the Base44 chat rebuilt
   native · D3: the heart — crews and plans on the same wire). One surface,
   two registers:
     /messages      → the inbox, in three segments:
                        SIGNALS — DMs + event rooms (the original inbox)
                        CREWS   — your circle (amigos) + your group rooms
                        PLANS   — the kickbacks: what/where/when, RSVP
     /messages/:id  → the thread: a DM pair, an event's room, a crew, or
                      a plan's room

   RLS is the wall: participants-only reads/writes (0017/0023), and the
   stream respects it too — the new kinds ride subscribeThread unchanged.
   Doctrine: crews and plans are built FROM friendship — you bring YOUR
   people. The circle is private; no public counts anywhere. Ley 6: names
   and faces lead every row. Ley 11: pre-migration each layer says the
   wires are going in — no dead composer, no fake inbox. Ley 14: starlight.
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
const CHROME = 'linear-gradient(100deg,#F6F6FA 0%,#A6ABBA 26%,#FCFCFE 50%,#8E94A6 73%,#EFEFF4 100%)' // deck formula — jewelry, one moment per screen (v8 D3)
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
const SEGS = ['signals', 'crews', 'plans']

function Inbox({ me, wide }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [threads, setThreads] = useState([])
  const [circle, setCircle] = useState(null)     // null = probing · true · false (0023 not live)
  const [circleData, setCircleData] = useState({ friends: [], pending_in: [], pending_out: [] })
  const [plans, setPlans] = useState([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [crewSheet, setCrewSheet] = useState(false)
  const [planSheet, setPlanSheet] = useState(false)
  const [reqBusy, setReqBusy] = useState(null)   // profile id mid-answer
  const [segErr, setSegErr] = useState('')
  const [closeSet, setCloseSet] = useState(() => new Set())   // curated close friends (0029)
  const [craftsByFriend, setCraftsByFriend] = useState(new Map())
  const [closeBusy, setCloseBusy] = useState(null)   // profile id mid-toggle

  // the segment lives in the URL (?seg=) so CREWS/PLANS are deep-linkable;
  // pre-0023 everything honestly collapses to SIGNALS (no dead segments)
  const rawSeg = searchParams.get('seg')
  const seg = circle === true && SEGS.includes(rawSeg) ? rawSeg : 'signals'
  const setSeg = (s) => { setSegErr(''); setSearchParams(s === 'signals' ? {} : { seg: s }, { replace: true }) }

  useEffect(() => {
    let alive = true
    fetchInbox(me.id).then((rows) => { if (alive) { setThreads(rows); setLoading(false) } })
    circleReady().then((r) => {
      if (!alive) return
      setCircle(r)
      if (r) {
        myCircle().then((c) => { if (alive) setCircleData(c) })
        myCloseFriends().then((list) => { if (alive) setCloseSet(new Set(list.map((p) => p.id))) })
        myPlans().then((ps) => { if (alive) { setPlans(ps); setPlansLoading(false) } })
      } else setPlansLoading(false)
    })
    return () => { alive = false }
  }, [me.id])

  // craft "a un tap" (v9 D1): my_circle omits craft, so one grouped read
  // fills each friend's primary craft for the roster — no per-row probe,
  // re-runs when the circle grows (a request accepted from search)
  const friendIds = circleData.friends.map((f) => f.id).join(',')
  useEffect(() => {
    if (!friendIds) { setCraftsByFriend(new Map()); return undefined }
    let alive = true
    fetchCraftsForProfiles(friendIds.split(',')).then((m) => { if (alive) setCraftsByFriend(m) })
    return () => { alive = false }
  }, [friendIds])

  // ?new=1&seg=plans (CreateCentral's door) opens the plan sheet ONCE,
  // then the param is stripped — a reload doesn't re-open it
  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    if (circle === null) return                     // wait for the probe
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next, { replace: true })
    if (circle === true && searchParams.get('seg') === 'plans') setPlanSheet(true)
  }, [circle, searchParams, setSearchParams])

  const refreshPlans = useCallback(() => { myPlans().then(setPlans) }, [])
  const refreshInbox = useCallback(() => { fetchInbox(me.id).then(setThreads) }, [me.id])

  // accept / decline a friend request — per-row busy, honest error
  const answerRequest = async (person, accept) => {
    if (reqBusy) return
    setReqBusy(person.id); setSegErr('')
    try {
      await respondFriend(person.id, accept)
      setCircleData((c) => ({
        ...c,
        pending_in: c.pending_in.filter((p) => p.id !== person.id),
        friends: accept ? [...c.friends, person] : c.friends,
      }))
    } catch (e) { setSegErr(e?.message || "couldn't answer — try again") }
    finally { setReqBusy(null) }
  }

  // curate close friends (0029) — the Instagram model: a subset WITHIN your
  // amigos. Optimistic star, honest rollback with a voice (Ley 11).
  const toggleClose = async (person) => {
    if (closeBusy) return
    const isClose = closeSet.has(person.id)
    setCloseBusy(person.id); setSegErr('')
    setCloseSet((prev) => { const n = new Set(prev); isClose ? n.delete(person.id) : n.add(person.id); return n })
    try { isClose ? await removeCloseFriend(person.id) : await addCloseFriend(person.id) }
    catch (e) {
      setCloseSet((prev) => { const n = new Set(prev); isClose ? n.add(person.id) : n.delete(person.id); return n })
      setSegErr(e?.message || "couldn't update close friends — try again")
    } finally { setCloseBusy(null) }
  }

  // RSVP: optimistic flip + rollback on refusal (Ley 11 — the counts on
  // screen are only ever real or immediately corrected)
  const doRsvp = async (planId, status) => {
    const prev = plans
    setSegErr('')
    setPlans((cur) => cur.map((p) => (p.id === planId ? withMyRsvp(p, me.id, status) : p)))
    try { await rsvpPlan(planId, status) }
    catch (e) { setPlans(prev); setSegErr(e?.message || "couldn't answer — try again") }
  }

  const doCancel = async (planId) => {
    if (!window.confirm('Cancel this plan? Everyone in it sees it canceled — the room stays open.')) return
    setSegErr('')
    try {
      await cancelPlan(planId)
      setPlans((cur) => cur.map((p) => (p.id === planId ? { ...p, status: 'canceled' } : p)))
    } catch (e) { setSegErr(e?.message || "couldn't cancel — try again") }
  }

  // an invitee walks out — leave_plan (0026), then the card disappears (refetch)
  const doLeave = async (planId) => {
    if (!window.confirm('¿salir del plan?')) return
    setSegErr('')
    try {
      await leavePlan(planId)
      refreshPlans()
    } catch (e) { setSegErr(e?.message || "couldn't leave — try again") }
  }

  // the creator changes who sees it (v9 D2) — optimistic, honest rollback
  const doVisibility = async (planId, tier) => {
    // roll back ONLY this plan's tier on failure — snapshotting the whole
    // list would silently revert a concurrent RSVP/cancel (review catch)
    const prevTier = plans.find((p) => p.id === planId)?.visibility
    setSegErr('')
    setPlans((cur) => cur.map((p) => (p.id === planId ? { ...p, visibility: tier } : p)))
    try { await setPlanVisibility(planId, tier) }
    catch (e) {
      setPlans((cur) => cur.map((p) => (p.id === planId ? { ...p, visibility: prevTier } : p)))
      setSegErr(e?.message || "couldn't change who sees it — try again")
    }
  }

  // plan rooms live under PLANS (behind each card's door) — SIGNALS and
  // CREWS stay clean of kind='plan' threads
  const signals = threads.filter((t) => t.kind === 'dm' || t.kind === 'event')
  const crews = threads.filter((t) => t.kind === 'group')
  const booting = loading || circle === null
  const count = booting ? null : seg === 'signals' ? signals.length : seg === 'crews' ? crews.length : plans.length

  return (
    <Shell wide={wide}>
      <Header wide={wide} count={count} />

      {circle === true && <SegRow seg={seg} onSeg={setSeg} />}

      {booting ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ maxWidth: wide ? '720px' : undefined }}>
          {segErr && <div role="alert" style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '12px' }}>⚠ {segErr}</div>}

          {/* ---------------- SIGNALS — the original inbox ---------------- */}
          {seg === 'signals' && (
            signals.length === 0 ? (
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
              <div style={{ marginTop: '14px' }}>
                {signals.map((t, i) => (
                  <InboxRow key={t.id} t={t} me={me} last={i === signals.length - 1} onOpen={() => navigate('/messages/' + t.id)} />
                ))}
              </div>
            )
          )}

          {/* ---------------- CREWS — your people: find, add, curate ---------------- */}
          {seg === 'crews' && (
            <>
              {/* the entry door from your own surface (v9 D1) — search anyone,
                  send from the row; the world's + amigo is the other path */}
              <PeopleSearch me={me} circle={circleData} onCircleChange={setCircleData}
                onOpenWorld={(uid) => navigate('/user/' + uid)} />
              <CircleBlock circle={circleData} busyId={reqBusy} onAnswer={answerRequest}
                closeSet={closeSet} closeBusy={closeBusy} onToggleClose={toggleClose}
                craftsByFriend={craftsByFriend} onOpenWorld={(uid) => navigate('/user/' + uid)} />
              {crews.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  {crews.map((t, i) => (
                    <InboxRow key={t.id} t={t} me={me} last={i === crews.length - 1} onOpen={() => navigate('/messages/' + t.id)} />
                  ))}
                </div>
              )}
              {circleData.friends.length > 0 ? (
                <CreateRow testid="crew-create" title="START A CREW" kicker="your people, one room" onGo={() => setCrewSheet(true)} />
              ) : (
                <div style={{ marginTop: '20px', padding: '26px 24px', borderRadius: '16px', border: `1px solid ${HAIR}`, textAlign: 'center' }}>
                  <p style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.65, margin: 0, maxWidth: '320px', display: 'inline-block' }}>
                    a crew is made of your people — find and add amigos above, or browse the community.
                  </p>
                  <div>
                    <button className="pressable" onClick={() => navigate('/community')} style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', minHeight: '40px', padding: '11px 20px', color: BONE_MID, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      browse the community <ArrowUpRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ---------------- PLANS — the kickbacks ---------------- */}
          {seg === 'plans' && (
            plansLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <>
                {plans.length === 0 && (
                  <div style={{ marginTop: '22px', padding: '38px 26px', borderRadius: '18px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(232,233,237,.05), rgba(232,233,237,.01))', textAlign: 'center' }}>
                    <Mark type="star" size={16} color={SILVER} style={{ marginBottom: '12px' }} />
                    <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '26px', letterSpacing: '.03em', lineHeight: .95, margin: 0, color: BONE }}>NO PLANS YET</h2>
                    <p style={{ fontFamily: 'DM Sans', fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, margin: '12px auto 0', maxWidth: '300px' }}>
                      a kickback, a roadtrip, fucho on saturday. make the first one.
                    </p>
                  </div>
                )}
                {plans.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    {plans.map((p) => (
                      <PlanCard key={p.id} p={p} meId={me.id}
                        onRsvp={doRsvp} onCancel={doCancel} onLeave={doLeave} onVisibility={doVisibility}
                        onRoom={() => p.thread_id && navigate('/messages/' + p.thread_id)} />
                    ))}
                  </div>
                )}
                <CreateRow testid="plan-create" title="MAKE A PLAN" kicker="what · where · when" onGo={() => setPlanSheet(true)} />
              </>
            )
          )}
        </div>
      )}

      {crewSheet && (
        <CrewSheet friends={circleData.friends} onClose={() => setCrewSheet(false)}
          onGoCommunity={() => { setCrewSheet(false); navigate('/community') }}
          onCreated={(threadId) => navigate('/messages/' + threadId)} />
      )}
      {planSheet && (
        <PlanSheet friends={circleData.friends} onClose={() => setPlanSheet(false)}
          onCreated={() => { setPlanSheet(false); refreshPlans(); refreshInbox(); setSeg('plans') }} />
      )}
    </Shell>
  )
}

/* the mono segmented row — SIGNALS · CREWS · PLANS */
function SegRow({ seg, onSeg }) {
  const items = [
    { key: 'signals', label: 'SIGNALS' },
    { key: 'crews', label: 'CREWS' },
    { key: 'plans', label: 'PLANS' },
  ]
  return (
    <div role="tablist" aria-label="Message registers" style={{ display: 'flex', alignItems: 'center', marginTop: '16px', borderBottom: `1px solid ${HAIR}` }}>
      {items.map((it, i) => {
        const on = seg === it.key
        return (
          <span key={it.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {i > 0 && <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, padding: '0 2px' }}>·</span>}
            <button role="tab" aria-selected={on} className="pressable" data-testid={`inbox-seg-${it.key}`}
              onClick={() => onSeg(it.key)}
              style={{ background: 'transparent', border: 'none', borderBottom: `1px solid ${on ? BONE : 'transparent'}`, marginBottom: '-1px', minHeight: '40px', padding: '10px 10px 12px', color: on ? BONE : BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', textTransform: 'uppercase', cursor: 'pointer', transition: 'color .2s' }}>
              {it.label}
            </button>
          </span>
        )
      })}
    </div>
  )
}

/* YOUR CIRCLE — requests waiting on you, then the real roster (v9 D1): who
   your amigos ARE, each with craft + a tap to their world, and a star to
   curate close friends. The circle is intimate — nothing here is public. */
function CircleBlock({ circle, busyId, onAnswer, closeSet, closeBusy, onToggleClose, craftsByFriend, onOpenWorld }) {
  const { friends, pending_in } = circle
  if (!pending_in.length && !friends.length) return null
  const closeCount = friends.filter((f) => closeSet.has(f.id)).length
  return (
    <div style={{ marginTop: '18px' }}>
      {/* requests waiting on you */}
      {pending_in.length > 0 && (
        <>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>○ wants in</div>
          {pending_in.map((p) => {
            const busy = busyId === p.id
            const name = p.name || (p.username ? '@' + p.username : 'Member')
            const avatar = safeImg(p.avatar_url)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 2px', borderBottom: `1px solid ${HAIR}` }}>
                <span style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: CARD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {avatar
                    ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontFamily: 'Bebas Neue', fontSize: '16px', color: BONE }}>{(name || '?')[0].toUpperCase()}</span>}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'Bebas Neue', fontSize: '18px', color: BONE, letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                  <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: '3px' }}>wants in your circle</span>
                </span>
                <button className="pressable" data-testid={`circle-accept-${p.id}`} disabled={busy} onClick={() => onAnswer(p, true)}
                  style={{ background: BONE, border: 'none', borderRadius: '100px', minHeight: '40px', padding: '10px 18px', color: VOID, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 500, cursor: busy ? 'default' : 'pointer', opacity: busy ? .5 : 1, flexShrink: 0 }}>
                  {busy ? '…' : 'accept'}
                </button>
                <button className="pressable" disabled={busy} onClick={() => onAnswer(p, false)} aria-label={`Decline ${name}`}
                  style={{ background: 'transparent', border: `1px solid ${HAIR}`, borderRadius: '100px', minHeight: '40px', padding: '10px 14px', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: busy ? 'default' : 'pointer', opacity: busy ? .5 : 1, flexShrink: 0 }}>
                  decline
                </button>
              </div>
            )
          })}
        </>
      )}

      {/* the roster — the real circle, tappable, curatable */}
      {friends.length > 0 && (
        <>
          <div data-testid="circle-count" style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase', marginTop: pending_in.length ? '18px' : 0 }}>
            ○ your circle · {friends.length}{closeCount > 0 ? ` · ${closeCount} close` : ''}
          </div>
          {friends.map((f) => (
            <FriendRow key={f.id} f={f} craft={(craftsByFriend.get(f.id) || [])[0]}
              isClose={closeSet.has(f.id)} busy={closeBusy === f.id}
              onToggleClose={() => onToggleClose(f)} onOpen={() => onOpenWorld(f.id)} />
          ))}
          <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.1em', marginTop: '9px', lineHeight: 1.5 }}>
            tap ☆ for close friends — they see your close-only plans.
          </div>
        </>
      )}
    </div>
  )
}

/* one amigo in the roster: face + name + craft tap to their world; the
   star curates close friends (Ley 14 — a lit star means something). */
function FriendRow({ f, craft, isClose, busy, onToggleClose, onOpen }) {
  const name = f.name || (f.username ? '@' + f.username : 'Member')
  const avatar = safeImg(f.avatar_url)
  const tint = craft ? categoryMeta(craft.category).tint : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 2px', borderBottom: `1px solid ${HAIR}` }}>
      <button className="pressable" onClick={onOpen} aria-label={`Open ${name}'s world`}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
        <span style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${isClose ? 'rgba(232,233,237,.5)' : HAIR_HI}`, background: CARD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {avatar
            ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontFamily: 'Bebas Neue', fontSize: '16px', color: BONE }}>{(name || '?')[0].toUpperCase()}</span>}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: 'Bebas Neue', fontSize: '18px', color: BONE, letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          {craft
            ? <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '8px', color: `rgb(${tint})`, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{craft.name}</span>
            : (f.city && <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.1em', marginTop: '4px' }}>{f.city}</span>)}
        </span>
      </button>
      <button className="pressable" data-testid={`circle-close-${f.id}`} disabled={busy} onClick={onToggleClose}
        aria-pressed={isClose} aria-label={isClose ? `Remove ${name} from close friends` : `Add ${name} to close friends`}
        title={isClose ? 'In close friends' : 'Add to close friends'}
        style={{ background: 'transparent', border: 'none', minHeight: '40px', minWidth: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'default' : 'pointer', opacity: busy ? .5 : 1, flexShrink: 0, padding: '6px' }}>
        <Star size={17} strokeWidth={1.6} fill={isClose ? STAR : 'none'} color={isClose ? STAR : BONE_LOW}
          style={isClose ? { filter: 'drop-shadow(0 0 6px rgba(232,233,237,.5))' } : undefined} />
      </button>
    </div>
  )
}

/* the door rows — START A CREW / MAKE A PLAN, in the inbox row grammar */
function CreateRow({ testid, title, kicker, onGo }) {
  return (
    <button className="pressable" data-testid={testid} onClick={onGo}
      style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', minHeight: '44px', textAlign: 'left', background: 'transparent', border: 'none', borderTop: `1px solid ${HAIR}`, marginTop: '10px', padding: '14px 2px', cursor: 'pointer', transition: 'padding-left .2s ease' }}
      onMouseOver={(e) => { e.currentTarget.style.paddingLeft = '10px' }}
      onMouseOut={(e) => { e.currentTarget.style.paddingLeft = '2px' }}>
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
  return (
    <button className="pressable" onClick={onOpen}
      style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: last ? 'none' : `1px solid ${HAIR}`, padding: '14px 2px', cursor: 'pointer', transition: 'padding-left .2s ease' }}
      onMouseOver={(e) => { e.currentTarget.style.paddingLeft = '10px' }}
      onMouseOut={(e) => { e.currentTarget.style.paddingLeft = '2px' }}>
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
          {kicker && <span style={{ fontFamily: 'DM Mono', fontSize: '7.5px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase', flexShrink: 0 }}>{kicker}</span>}
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

/* ------------------------------- plans ------------------------------- */

/* the plan's when, human and honest — relDay's cousin for the FUTURE */
function planWhen(iso) {
  if (!iso) return 'when tbd'
  const d = new Date(iso)
  if (isNaN(d)) return 'when tbd'
  const now = new Date()
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const days = Math.round((startOf(d) - startOf(now)) / 86400000)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (days === 0) return `today · ${time}`
  if (days === 1) return `tomorrow · ${time}`
  if (days === -1) return `yesterday · ${time}`
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`
}

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
  return (
    <div data-testid={`plan-card-${p.id}`}
      style={{ border: `1px solid ${HAIR_HI}`, borderRadius: '14px', padding: '16px 16px 12px', marginBottom: '12px', background: 'linear-gradient(150deg, rgba(232,233,237,.04), rgba(232,233,237,.01))', opacity: canceled ? .55 : 1 }}>
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
      <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.12em', marginTop: '10px' }}>
        {p.in_count || 0} in · {p.maybe_count || 0} maybe{!mine && creatorName ? ` · by ${creatorName}` : ''}
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

      {!canceled && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <RsvpBtn testid="plan-rsvp-in" on={p.my_status === 'in'} label="in" mark="dot" onClick={() => onRsvp(p.id, 'in')} />
          <RsvpBtn testid="plan-rsvp-maybe" on={p.my_status === 'maybe'} label="maybe" mark="ring" onClick={() => onRsvp(p.id, 'maybe')} />
          <RsvpBtn testid="plan-rsvp-out" on={p.my_status === 'out'} label="out" mark="cross" onClick={() => onRsvp(p.id, 'out')} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '12px', borderTop: `1px solid ${HAIR}`, paddingTop: '4px' }}>
        <button className="pressable" data-testid="plan-room-door" onClick={onRoom}
          style={{ background: 'transparent', border: 'none', minHeight: '40px', padding: '10px 2px', color: SILVER, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.16em', textTransform: 'uppercase', cursor: 'pointer' }}>
          the room →
        </button>
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
      style={{ flex: 1, minHeight: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: on ? 'rgba(242,238,230,.09)' : 'transparent', border: `1px solid ${on ? 'rgba(242,238,230,.3)' : HAIR}`, borderRadius: '10px', padding: '10px 8px', color: on ? BONE : BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.18em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all .2s' }}>
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
      <div onClick={() => { if (!busy) onClose() }} aria-hidden
        style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(7,8,14,.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'fadeIn .25s ease' }} />
      <div role="dialog" aria-modal="true" aria-label={label}
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

/* who's coming — the checklist of YOUR amigos (the only people a crew or
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
          A crew is a group chat that stays — name it and bring your amigos.
        </p>
        <label htmlFor="crew-title" style={sheetLabel}>THE NAME</label>
        <input id="crew-title" data-testid="crew-title-input" value={title} maxLength={60} disabled={busy}
          placeholder="los del sábado" autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && canGo) create() }}
          style={sheetInput} />
        <div style={{ marginTop: '16px' }}>
          <label style={sheetLabel}>WHO'S IN <span style={{ opacity: .6 }}>· your amigos</span></label>
          {friends.length ? (
            <FriendPick friends={friends} sel={sel} onToggle={toggle} testPrefix="crew-friend" busy={busy} />
          ) : (
            <div style={{ padding: '14px 0 4px' }}>
              <p style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.6, margin: 0 }}>
                a crew is made of your people — add amigos from their worlds first.
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
   PÚBLICO / AMIGOS / CLOSE FRIENDS, default amigos. A lit star means close
   (Ley 14 — light with meaning). Reused at create and on the plan card. */
const VIS_META = {
  public: { icon: Globe, sub: 'anyone can find it' },
  friends: { icon: Users, sub: 'your amigos' },
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
              style={{ flex: 1, minHeight: compact ? '36px' : '46px', display: 'inline-flex', flexDirection: compact ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: compact ? '5px' : '5px', background: on ? 'rgba(242,238,230,.09)' : 'transparent', border: `1px solid ${on ? 'rgba(242,238,230,.3)' : HAIR}`, borderRadius: '10px', padding: compact ? '8px 6px' : '10px 6px', color: on ? BONE : BONE_LOW, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .6 : 1, transition: 'all .2s' }}>
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
  const [vis, setVis] = useState('friends')   // v9 D2 — default amigos (0029)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const toggle = (id) => setSel((cur) => { const n = new Set(cur); n.has(id) ? n.delete(id) : n.add(id); return n })
  const canGo = !busy && title.trim().length > 0

  const create = async () => {
    if (!canGo) return
    setBusy(true); setErr('')
    try {
      const startsAt = when && !isNaN(new Date(when)) ? new Date(when).toISOString() : null
      const { plan_id } = await createPlan({ title, spot, detail, startsAt, inviteeIds: [...sel] })
      // the plan (and its room) now EXIST at the default 'friends'. Setting a
      // non-default tier is a best-effort SECOND step — a blip there must NOT
      // report "couldn't make the plan" (it was made) nor strand the sheet open
      // and invite a duplicating retry (review catch). The creator adjusts the
      // tier on the plan card if this misses.
      if (vis !== 'friends' && plan_id) {
        try { await setPlanVisibility(plan_id, vis) } catch { /* non-fatal — plan lives at 'friends' */ }
      }
      onCreated()
    } catch (e) { setErr(e?.message || "couldn't make the plan — try again"); setBusy(false) }
  }

  return (
    <Sheet label="Make a plan" busy={busy} onClose={onClose}>
      <SheetTop kicker="make a plan" busy={busy} onClose={onClose} />
      <div className="no-scrollbar" style={{ padding: '12px 20px calc(20px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto', position: 'relative', flex: 1, minHeight: 0 }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '27px', lineHeight: .95, color: BONE }}>WHAT, WHERE, WHEN</div>
        <p style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.55, margin: '8px 0 16px' }}>
          A kickback, a roadtrip, fucho on saturday — the plan gets its own room, your amigos get the door.
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
            <label style={sheetLabel}>WHO'S INVITED <span style={{ opacity: .6 }}>· your amigos</span></label>
            {friends.length ? (
              <FriendPick friends={friends} sel={sel} onToggle={toggle} testPrefix="plan-friend" busy={busy} />
            ) : (
              <p style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.6, margin: '4px 0 0' }}>
                your amigos will show here — add them from their worlds. the plan can start with just you.
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

  // live: new messages arrive without a reload; RLS gates the stream.
  // Only OTHERS' messages move the read cursor — your own echo already
  // did at send time (write-amplification catch).
  useEffect(() => {
    const off = subscribeThread(threadId, (m) => {
      setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]))
      if (m.sender_id !== me.id) markThreadRead(threadId, me.id)
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

  // walk out of a crew — the room continues without you (groups only)
  const leave = async () => {
    if (leaving) return
    if (!window.confirm('Leave this crew? The room continues without you.')) return
    setLeaving(true); setErr('')
    try {
      await leaveCrew(threadId)
      navigate('/messages?seg=crews')
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
        <button className="pressable" onClick={() => navigate('/messages')} style={{ background: 'rgba(242,238,230,.06)', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '10px 20px', color: BONE_MID, fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
          ← Messages
        </button>
      </div>
    </Shell>
  )

  const title = threadTitle(thread)
  const other = thread.kind === 'dm' ? thread.others?.[0] : null
  // back lands on the segment this thread lives in (Ley 9 — the way back
  // is the way you came)
  const backTo = thread.kind === 'group' ? '/messages?seg=crews' : thread.kind === 'plan' ? '/messages?seg=plans' : '/messages'

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', display: 'flex', flexDirection: 'column' }}>
      {/* the sky is the app's shared atmosphere (v8 D2) — QUIET register:
          where people read each other, the galaxy shuts up */}

      {/* header — who this room is (tap the name: their world / the event) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(10,10,13,.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: `1px solid ${HAIR}` }}>
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
              <span style={{ display: 'block', fontFamily: 'Bebas Neue', fontSize: '17px', color: BONE, letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
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
        {msgs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '46px 20px' }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ the room is open</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: BONE, marginTop: '10px' }}>SAY THE FIRST THING</div>
          </div>
        ) : (
          <div role="log" aria-live="polite" aria-label="Messages" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                    {!mine && isRoomKind(thread.kind) && (
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
