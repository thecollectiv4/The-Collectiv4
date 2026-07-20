import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { useWide } from '@/lib/useIsDesktop'
import { MapPin, Calendar, Clock, Ticket, ArrowUpRight, ArrowRight, Loader2, Archive } from 'lucide-react'
import { normVibe, vibeMeta } from '@/lib/match'
import FoundersLine from '@/components/FoundersLine'
import { CARD_TINT, cardGlass } from '@/lib/glass'
import { tintChannel } from '@/lib/cosmos'

/* =========================================================================
   EVENTS — the EVENT tab (D1, decisión de Pato): solo eventos, TODOS los
   de la app. The tab stops being one countdown page and becomes THE
   directory of rooms — the base the future map grows on. Selling stays
   intact: every room opens at /e/:slug (the same EventShow spread, the
   same checkout, byte-identical Stripe).

   Ley 2 — the 3-second answer: what's on, when, how do I get in.
   Ley 6 — who's pulling up leads the featured room (Partiful steal).
   Ley 14 — the section reads warm bone: making nights, not instruments.
   Ley 11 — Stripe's cancel_url returns here (/?ticket=cancelled): the
   banner answers honestly. No invented rooms, no fake fullness.
   ========================================================================= */

const VOID = 'var(--bg)'
const BONE = 'var(--cream)'
const BONE_MID = 'var(--cream-soft)'
const BONE_LOW = 'var(--cream-dim)'
const SILVER = 'var(--silver)'
const STAR = 'var(--star)'
// v12: was a flat opaque plate ('var(--card-solid)'), so Events was the one consumer
// surface whose cards sat ON the constellation instead of sampling it, while
// Community's identical card already used cardGlass(). Same frame, same card,
// two materials — the exact drift glass.js exists to end.
const CARD = CARD_TINT
const HAIR = 'rgba(var(--ink-rgb),0.08)'
const HAIR_HI = 'rgba(var(--ink-rgb),0.15)'
const CHROME = 'var(--chrome)' // deck formula — jewelry, one moment per screen (v8 D3)
const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''
function hash(s = '') { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() : 'DATE TBA'
const isPast = (iso) => !!iso && new Date(iso) < new Date(new Date().toDateString())

export default function Events() {
  const navigate = useNavigate()
  const live = useLiveEvent()               // the house's next room — the featured spread
  const wide = useWide()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [attendees, setAttendees] = useState([])
  const [count, setCount] = useState(0)

  // the room directory cascades ONCE per mount — first load only; there is no
  // refilter UI here, so no crossfade (plan 009). STATE on a timer, not a ref:
  // attendees/count land right after the events and re-render mid-cascade — a
  // ref flip stripped .card-in at that instant and cut the cascade short.
  // 950ms = last delay (8×50+100) + --dur-slow (500) + margin; by then the
  // animation is done and removing the class changes nothing visually.
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (loading || entered) return
    const t = setTimeout(() => setEntered(true), 950)
    return () => clearTimeout(t)
  }, [loading, entered])

  // Stripe returns cancellations here (cancel_url /?ticket=cancelled) —
  // answer honestly, then get out of the way. (success goes to /claim.)
  const ticketStatus = searchParams.get('ticket')

  useEffect(() => {
    let alive = true
    const FIELDS = 'id,slug,title,edition,event_date,doors,venue,city,cover_url,status,tiers,is_house'
    const base = (withVibe) => supabase
      .from('events')
      .select(withVibe ? `${FIELDS},vibe` : FIELDS)
      .eq('status', 'published')
      .eq('is_test', false)
      .order('event_date', { ascending: true })
    base(true)
      .then(({ data, error }) => {
        if (!alive) return
        // ONLY the missing-column error (42703, pre-0021 environment) may
        // retry without vibe — the directory must never die over a column
        // that only decorates it (the useLiveEvent 0016 pattern)
        if (error && error.code === '42703') {
          base(false).then(({ data: d2 }) => { if (alive) { setEvents(d2 || []); setLoading(false) } })
            .catch(() => { if (alive) setLoading(false) })
          return
        }
        setEvents(data || []); setLoading(false)
      })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // who's pulling up — real faces on the featured room (Leyes 6, 11)
  useEffect(() => {
    if (!live.id) return
    supabase.rpc('confirmed_attendees', { p_event: live.id }).then(({ data }) => setAttendees(data || [])).catch(() => {})
    supabase.rpc('confirmed_count', { p_event: live.id }).then(({ data }) => setCount(data || 0)).catch(() => {})
  }, [live.id])

  const featured = live.raw && !isPast(live.raw.event_date) ? live.raw : null
  const upcoming = useMemo(
    () => events.filter((e) => !isPast(e.event_date) && e.id !== featured?.id),
    [events, featured]
  )
  const past = useMemo(
    () => events.filter((e) => isPast(e.event_date)).sort((a, b) => new Date(b.event_date) - new Date(a.event_date)),
    [events]
  )
  const pastCount = past.length
  // the most recent night — when nothing is upcoming, the archive's last
  // room keeps the front door alive (panel catch: la ausencia se compone)
  const lastRoom = past[0] || null
  const total = (featured ? 1 : 0) + upcoming.length

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', overflowX: 'hidden' }}>
      {/* the sky is the app's shared atmosphere (v8 D1) — warm bone here,
          medium register: this is where nights happen (Ley 14) */}
      <div style={{ position: 'relative', zIndex: 2, padding: wide ? '34px clamp(40px, 5vw, 76px) 70px' : '22px 22px 40px', maxWidth: wide ? '1440px' : undefined, margin: wide ? '0 auto' : undefined }}>

        {/* header — the title answers with the count beside it (Leyes 2, 7).
            No stray marks beside the display: an ✕ at the top of a page
            reads as a close button that closes nothing (panel catch, Ley 9). */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: wide ? '.34em' : '.28em', textTransform: 'uppercase', marginBottom: '4px' }}>The rooms · Ran By Artists</div>
            <h1 style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '58px' : '40px', letterSpacing: '.02em', lineHeight: .85, margin: 0, ...chromeText }}>EVENTS</h1>
          </div>
          {!loading && (
            <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', paddingBottom: wide ? '7px' : '5px' }}>
              {String(total).padStart(2, '0')} {total === 1 ? 'room' : 'rooms'} open
            </div>
          )}
          {/* the house door — the flagship world (D4): what a world IS,
              shown not explained */}
          <button className="pressable" data-testid="house-door" onClick={() => navigate('/c4')}
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '7px 14px', color: BONE_MID, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.16em', textTransform: 'uppercase', cursor: 'pointer', transition: 'border-color .2s, color .2s, transform .2s', marginBottom: '4px' }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.4)'; e.currentTarget.style.color = BONE }}
            onMouseOut={e => { e.currentTarget.style.borderColor = HAIR_HI; e.currentTarget.style.color = BONE_MID }}>
            ◇ the house world <ArrowUpRight size={11} />
          </button>
        </div>

        {/* Stripe cancel lands here — say it straight, no drama (Ley 11) */}
        {ticketStatus === 'cancelled' && (
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(229,160,160,.4)', borderRadius: '12px', padding: '14px 18px', background: 'rgba(229,160,160,.06)' }}>
            <span style={{ color: 'var(--warn)', fontWeight: 500, fontSize: '13px', fontFamily: 'DM Sans' }}>Checkout cancelled. No charge was made.</span>
          </div>
        )}
        {ticketStatus === 'success' && (
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(var(--ink-rgb),.4)', borderRadius: '12px', padding: '14px 18px', background: 'rgba(var(--ink-rgb),.06)' }}>
            <span style={{ color: SILVER, fontWeight: 500, fontSize: '13px', fontFamily: 'DM Sans' }}>You're in. Check your email for your ticket.</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <>
            {/* THE FEATURED ROOM — the house's next night, as a spread */}
            {featured && (
              <div className={entered ? undefined : 'card-in'}
                style={entered ? undefined : { animationDelay: '0ms' }}>
                <FeaturedRoom
                  e={featured}
                  live={live}
                  attendees={attendees}
                  count={count}
                  wide={wide}
                  onEnter={() => navigate(featured.slug ? `/e/${featured.slug}` : '/')}
                />
              </div>
            )}

            {/* MORE ROOMS — every other published event, honest and dated */}
            {upcoming.length > 0 && (
              <div style={{ marginTop: featured ? (wide ? '44px' : '32px') : '22px' }}>
                <RowMarker label="MORE ROOMS" kicker="on the platform" />
                <div style={{ display: wide ? 'grid' : 'flex', ...(wide ? { gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' } : { flexDirection: 'column' }), gap: wide ? '18px' : '14px' }}>
                  {upcoming.map((e, i) => (
                    /* display:grid so the RoomCard child stretches to the row's
                       height in the wide grid (the wrapper is now the grid item) */
                    <div key={e.id} className={entered ? undefined : 'card-in'}
                      style={entered ? { display: 'grid' } : { display: 'grid', animationDelay: `${Math.min(i, 8) * 50 + 100}ms` }}>
                      <RoomCard e={e} wide={wide} onOpen={() => navigate(e.slug ? `/e/${e.slug}` : '/')} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* nothing upcoming? the absence COMPOSES (panel catch, Leyes 4/6/11):
                the statement on one side, the LAST room — a real night, real
                date — on the other, and a click that keeps the "stay close"
                promise (Ley 9: the copy's invitation gets a real door). */}
            {!featured && upcoming.length === 0 && (
              <div style={{ marginTop: '22px', display: wide ? 'grid' : 'flex', ...(wide ? { gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: '22px', alignItems: 'start' } : { flexDirection: 'column', gap: '14px' }) }}>
                <div className={entered ? undefined : 'card-in'} style={{ padding: wide ? '46px 40px' : '38px 24px', borderRadius: '18px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(var(--ink-rgb),.05), rgba(var(--ink-rgb),.01))', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', animationDelay: '0ms' }}>
                  <MiniStars seed="no-rooms" k={wide ? 0.3 : 0.6} />
                  <div style={{ position: 'relative' }}>
                    {/* bone, not chrome — the page title owns this screen's
                        one chrome moment (Ley 8, v8 D3) */}
                    <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '84px' : '54px', lineHeight: .85, color: BONE, opacity: .92 }}>00</div>
                    <h2 style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '36px' : '28px', letterSpacing: '.03em', lineHeight: .95, margin: '10px 0 0', color: BONE }}>NO ROOMS OPEN TONIGHT</h2>
                    <p style={{ fontFamily: 'DM Sans', fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, margin: '12px 0 0', maxWidth: '340px' }}>
                      The next one is being built. Stay close — the room always comes back.
                    </p>
                    <button className="pressable" onClick={() => navigate('/community')}
                      style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(var(--ink-rgb),.06)', border: '1px solid rgba(var(--ink-rgb),.22)', borderRadius: '100px', padding: '10px 18px', color: BONE, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.16em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      meanwhile — find your people <ArrowUpRight size={12} />
                    </button>
                  </div>
                </div>
                {/* the last room — the archive keeps a face on the door */}
                {lastRoom && (
                  <div className={entered ? undefined : 'card-in'} style={{ animationDelay: '100ms' }}>
                    <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase', marginBottom: '9px' }}>the last room</div>
                    <RoomCard e={lastRoom} pastRoom wide={wide} onOpen={() => navigate(lastRoom.slug ? `/e/${lastRoom.slug}` : '/editions')} />
                  </div>
                )}
              </div>
            )}

            {/* the archive — where the past editions live */}
            {pastCount > 0 && (
              <button className="row-lead" onClick={() => navigate('/editions')}
                style={{ marginTop: wide ? '36px' : '26px', width: '100%', display: 'flex', alignItems: 'center', gap: '14px', background: 'transparent', border: 'none', borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}`, padding: '16px 2px', cursor: 'pointer', textAlign: 'left' }}>
                <Archive size={15} style={{ color: SILVER, flexShrink: 0 }} strokeWidth={1.6} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'Bebas Neue', fontSize: '20px', color: BONE, letterSpacing: '.03em', lineHeight: 1 }}>PAST EDITIONS</span>
                  <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: '4px' }}>{pastCount === 1 ? 'one night in the archive' : `${String(pastCount).padStart(2, '0')} nights in the archive`}</span>
                </span>
                <ArrowUpRight size={15} style={{ color: SILVER, flexShrink: 0 }} />
              </button>
            )}

            {/* the close — the page ends on purpose, not by running out
                (panel catch, Ley 4): the house signature anchors the void */}
            <div style={{ marginTop: wide ? '54px' : '38px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ height: '1px', flex: 1, background: `linear-gradient(90deg,transparent,${HAIR_HI})` }} />
              <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.22em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                <FoundersLine />
              </span>
              <span style={{ fontFamily: 'Bebas Neue', fontSize: '15px', color: SILVER }}>4</span>
              <div style={{ height: '1px', flex: 1, background: `linear-gradient(270deg,transparent,${HAIR_HI})` }} />
            </div>
          </>
        )}
      </div>

      {/* grain lives in the app-wide varnish now (v8: one grain, 5%, over all) */}
    </div>
  )
}

/* ---- the featured room: a spread, not a card ---- */
function FeaturedRoom({ e, live, attendees, count, wide, onEnter }) {
  const cover = safeImg(e.cover_url)
  const availableTiers = (e.tiers || []).filter((t) => t.status === 'available')
  const fromPrice = availableTiers.length ? Math.min(...availableTiers.map((t) => t.price)) / 100 : null
  // the declared character (0021) — the featured spread wears its light (Ley 14)
  const vibe = normVibe(e.vibe)
  const vMeta = vibe?.kind ? vibeMeta(vibe.kind) : null
  const facts = [
    [Calendar, fmtDate(e.event_date)],
    e.doors ? [Clock, e.doors.toUpperCase()] : null,
    (e.venue || e.city) ? [MapPin, (e.venue || e.city).toUpperCase()] : null,
  ].filter(Boolean)

  return (
    <div className="pressable feat-room" onClick={onEnter} role="button" tabIndex={0} aria-label={`Enter ${e.title}`}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onEnter() } }}
      style={{ marginTop: '18px', position: 'relative', borderRadius: '20px', overflow: 'hidden', border: `1px solid rgba(var(--ink-rgb),.16)`, background: CARD, cursor: 'pointer', boxShadow: '0 18px 60px rgba(var(--shadow-rgb),.45)' }}>
      {/* the banner — cover or the room's own sky */}
      <div className="disc-banner" style={{ position: 'relative', height: wide ? '340px' : '230px', overflow: 'hidden', background: VOID }}>
        {cover
          ? <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <MiniStars seed={e.slug || e.id} dense k={wide ? 0.3 : 0.6} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(var(--void-rgb),.05) 20%, rgba(var(--void-rgb),.55) 62%, rgba(var(--void-rgb),.96) 100%)' }} />
        <span style={{ position: 'absolute', top: '14px', left: '14px', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.2em', color: BONE, border: `1px solid rgba(var(--ink-rgb),.35)`, borderRadius: '100px', padding: '4px 11px', background: 'rgba(var(--void-rgb),.55)', textTransform: 'uppercase' }}>
          {e.edition || 'The next room'}
        </span>
        {/* identity block over a guaranteed scrim (Ley 3) */}
        <div style={{ position: 'absolute', left: wide ? '28px' : '18px', right: wide ? '28px' : '18px', bottom: wide ? '20px' : '14px' }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: SILVER, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: '8px' }}>The Collectiv4 presents</div>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? 'clamp(54px, 6vw, 84px)' : '44px', letterSpacing: '.01em', lineHeight: .88, color: BONE, textShadow: '0 2px 24px rgba(var(--shadow-rgb),.6)' }}>{e.title}</div>
        </div>
      </div>

      {/* the facts + the door */}
      <div style={{ padding: wide ? '18px 28px 22px' : '14px 18px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'center' }}>
          {facts.map(([Icon, text], i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Icon size={12} strokeWidth={1.5} style={{ color: BONE }} />
              <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_MID, letterSpacing: '.06em' }}>{text}</span>
            </span>
          ))}
          {/* the room's declared character — its light, not decoration (Ley 14) */}
          {vMeta && (
            <span className={vMeta.pulse === 'warm' ? 'temp-warm' : vMeta.pulse === 'electric' ? 'temp-electric' : undefined}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', border: `1px solid rgba(${tintChannel(vMeta.tint)},.4)`, background: `rgba(${tintChannel(vMeta.tint)},.06)`, borderRadius: '100px', padding: '4px 12px' }}>
              <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '9px', color: `rgb(${tintChannel(vMeta.tint)})` }}>{vMeta.mark}</span>
              <span style={{ fontFamily: 'DM Mono', fontSize: '8.5px', letterSpacing: '.18em', textTransform: 'uppercase', color: BONE }}>{vMeta.label}</span>
              {vibe.sound.length > 0 && <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_MID, letterSpacing: '.08em' }}>{vibe.sound.slice(0, 3).join(' · ')}</span>}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
          {/* who's pulling up — real faces or the honest count (Leyes 6, 11) */}
          {attendees.length > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {attendees.slice(0, wide ? 8 : 5).map((a, i) => {
                  const src = safeImg(a.avatar_url)
                  return (
                    <span key={a.id || i} title={a.name || ''} style={{ width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden', border: `1px solid rgba(var(--silver-rgb),.5)`, background: CARD, marginLeft: i === 0 ? 0 : '-8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {src
                        ? <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontFamily: 'Bebas Neue', fontSize: '11px', color: BONE }}>{(a.name || '?')[0].toUpperCase()}</span>}
                    </span>
                  )
                })}
              </span>
              <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_MID, letterSpacing: '.1em' }}>{count} PULLING UP</span>
            </span>
          ) : (
            <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.1em' }}>{count} CONFIRMED</span>
          )}

          {/* the one clear door (DICE steal: one button, zero noise) */}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '10px', background: BONE, borderRadius: '11px', padding: wide ? '13px 22px' : '12px 18px', color: VOID, boxShadow: '0 4px 20px rgba(var(--ink-rgb),.14)' }}>
            <Ticket size={15} style={{ color: VOID }} />
            <span style={{ fontFamily: 'Bebas Neue', fontSize: '15px', letterSpacing: '.06em' }}>ENTER THE ROOM</span>
            {fromPrice != null && <span style={{ fontSize: '11px', color: 'rgba(var(--void-rgb),.55)', fontWeight: 500, fontFamily: 'DM Sans' }}>from ${fromPrice}</span>}
            <ArrowRight size={13} style={{ color: VOID }} />
          </span>
        </div>
      </div>
    </div>
  )
}

/* ---- a room in the directory (pastRoom: the archive's face) ---- */
function RoomCard({ e, onOpen, pastRoom, wide }) {
  const cover = safeImg(e.cover_url)
  return (
    <div onClick={onOpen} className="disc-card pressable" role="button" tabIndex={0} aria-label={`Open ${e.title}`}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen() } }}
      /* v12: real glass on the OUTER card only — never nested (glass.js).
         The sky now reads through the room cards the way it does through the
         people cards. */
      style={{ ...cardGlass(), position: 'relative', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer' }}>
      {/* v12: the banner scaled with nothing. In a 4-col grid at 1440 a card is
          ~330px wide, so a 128px banner is a 2.6:1 letterbox of someone's
          poster. Community already scales its equivalent (92 → 116). */}
      <div className="disc-banner" style={{ position: 'relative', height: pastRoom ? (wide ? '170px' : '148px') : (wide ? '150px' : '128px'), overflow: 'hidden', background: VOID }}>
        {cover ? <img src={cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MiniStars seed={e.slug || e.id} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(var(--void-rgb),.1) 30%, rgba(var(--void-rgb),.9) 100%)' }} />
        {pastRoom ? (
          <span style={{ position: 'absolute', top: '12px', right: '12px', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.16em', color: BONE_MID, border: `1px solid ${HAIR}`, borderRadius: '100px', padding: '3px 9px', background: 'rgba(var(--void-rgb),.5)', textTransform: 'uppercase' }}>in the archive</span>
        ) : e.edition && (
          <span style={{ position: 'absolute', top: '12px', right: '12px', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.16em', color: BONE, border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '3px 9px', background: 'rgba(var(--void-rgb),.5)', textTransform: 'uppercase' }}>{e.edition}</span>
        )}
        <div style={{ position: 'absolute', left: '16px', right: '16px', bottom: '13px' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '26px', letterSpacing: '.02em', lineHeight: .9, color: BONE }}>{e.title}</div>
        </div>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* the date lives on ONE line, always — the venue is the only text
            that absorbs truncation (panel catch) */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <Calendar size={10} style={{ color: BONE_LOW }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_MID, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{fmtDate(e.event_date)}</span>
        </span>
        {(e.venue || e.city) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
            <MapPin size={10} style={{ color: BONE_LOW, flexShrink: 0 }} />
            <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_LOW, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.venue || e.city}</span>
          </span>
        )}
        <ArrowUpRight size={14} style={{ color: SILVER, marginLeft: 'auto', flexShrink: 0 }} />
      </div>
    </div>
  )
}

/* ---- shared row marker ---- */
function RowMarker({ label, kicker }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
      <span style={{ fontFamily: 'Bebas Neue', fontSize: '22px', letterSpacing: '.05em', lineHeight: 1, color: BONE }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${HAIR_HI}, transparent)` }} />
      {kicker && <span style={{ fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.26em', color: BONE_LOW, textTransform: 'uppercase' }}>{kicker}</span>}
    </div>
  )
}

/* ---- deterministic mini star field for cover-less rooms ----
   `k` scales the radii DOWN on wide containers — the viewBox stretches
   with the box, and without it stars balloon into planets (the v2
   StarField lesson, Ley 8). */
function MiniStars({ seed, dense, k = 1 }) {
  const rnd = mulberry32(hash(String(seed)) + 5)
  const stars = Array.from({ length: dense ? 34 : 20 }, () => ({ x: +(rnd() * 100).toFixed(1), y: +(rnd() * 100).toFixed(1), r: +(0.6 + rnd() * 1.3).toFixed(2), o: +(0.15 + rnd() * 0.55).toFixed(2) }))
  return (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 90% at 30% 0%, rgba(var(--ink-rgb),.08) 0%, transparent 60%), ${VOID}` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={(s.r / 2) * k} fill={STAR} opacity={s.o} />)}
      </svg>
    </div>
  )
}
