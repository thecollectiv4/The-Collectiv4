import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { useWide } from '@/lib/useIsDesktop'
import Constellation from '@/components/Constellation'
import { MapPin, Calendar, Clock, Ticket, ArrowUpRight, ArrowRight, Loader2, Archive } from 'lucide-react'

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
const NOISE = "<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(NOISE)}")`

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

  // Stripe returns cancellations here (cancel_url /?ticket=cancelled) —
  // answer honestly, then get out of the way. (success goes to /claim.)
  const ticketStatus = searchParams.get('ticket')

  useEffect(() => {
    let alive = true
    supabase
      .from('events')
      .select('id,slug,title,edition,event_date,doors,venue,city,cover_url,status,tiers,is_house')
      .eq('status', 'published')
      .eq('is_test', false)
      .order('event_date', { ascending: true })
      .then(({ data }) => { if (alive) { setEvents(data || []); setLoading(false) } })
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
  const pastCount = useMemo(() => events.filter((e) => isPast(e.event_date)).length, [events])
  const total = (featured ? 1 : 0) + upcoming.length

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', overflowX: 'hidden' }}>
      {/* the sky — warm bone temperature: this is where nights happen (Ley 14) */}
      <Constellation seed="the-rooms" quiet tint="242,238,230" />
      <div style={{ position: 'relative', zIndex: 2, padding: wide ? '34px clamp(40px, 5vw, 76px) 70px' : '22px 22px 40px', maxWidth: wide ? '1440px' : undefined, margin: wide ? '0 auto' : undefined }}>

        {/* header — the title answers with the count beside it (Leyes 2, 7) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: SILVER, letterSpacing: '.28em', paddingBottom: '8px' }}>✕</div>
            <div>
              <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: wide ? '.34em' : '.28em', textTransform: 'uppercase', marginBottom: '4px' }}>The rooms · Ran By Artists</div>
              <h1 style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '58px' : '40px', letterSpacing: '.02em', lineHeight: .85, margin: 0, ...chromeText }}>EVENTS</h1>
            </div>
          </div>
          {!loading && (
            <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', paddingBottom: wide ? '7px' : '5px' }}>
              {String(total).padStart(2, '0')} {total === 1 ? 'room' : 'rooms'} open
            </div>
          )}
        </div>

        {/* Stripe cancel lands here — say it straight, no drama (Ley 11) */}
        {ticketStatus === 'cancelled' && (
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(229,160,160,.4)', borderRadius: '12px', padding: '14px 18px', background: 'rgba(229,160,160,.06)' }}>
            <span style={{ color: '#E5A0A0', fontWeight: 500, fontSize: '13px', fontFamily: 'DM Sans' }}>Checkout cancelled. No charge was made.</span>
          </div>
        )}
        {ticketStatus === 'success' && (
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(242,238,230,.4)', borderRadius: '12px', padding: '14px 18px', background: 'rgba(242,238,230,.06)' }}>
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
              <FeaturedRoom
                e={featured}
                live={live}
                attendees={attendees}
                count={count}
                wide={wide}
                onEnter={() => navigate(featured.slug ? `/e/${featured.slug}` : '/')}
              />
            )}

            {/* MORE ROOMS — every other published event, honest and dated */}
            {upcoming.length > 0 && (
              <div style={{ marginTop: featured ? (wide ? '44px' : '32px') : '22px' }}>
                <RowMarker label="MORE ROOMS" kicker="on the platform" />
                <div style={{ display: wide ? 'grid' : 'flex', ...(wide ? { gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' } : { flexDirection: 'column' }), gap: wide ? '18px' : '14px' }}>
                  {upcoming.map((e) => (
                    <RoomCard key={e.id} e={e} onOpen={() => navigate(e.slug ? `/e/${e.slug}` : '/')} />
                  ))}
                </div>
              </div>
            )}

            {/* nothing on? honest, and forward (Ley 11 + always end forward) */}
            {!featured && upcoming.length === 0 && (
              <div style={{ marginTop: '22px', padding: '46px 26px', borderRadius: '18px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(242,238,230,.05), rgba(242,238,230,.01))', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <MiniStars seed="no-rooms" k={wide ? 0.3 : 0.6} />
                <div style={{ position: 'relative' }}>
                  <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '30px', letterSpacing: '.03em', lineHeight: .95, margin: 0, color: BONE }}>NO ROOMS OPEN TONIGHT</h2>
                  <p style={{ fontFamily: 'DM Sans', fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, margin: '14px auto 0', maxWidth: '320px' }}>
                    The next one is being built. Stay close — the room always comes back.
                  </p>
                </div>
              </div>
            )}

            {/* the archive — where the past editions live */}
            {pastCount > 0 && (
              <button className="pressable" onClick={() => navigate('/editions')}
                style={{ marginTop: wide ? '36px' : '26px', width: '100%', display: 'flex', alignItems: 'center', gap: '14px', background: 'transparent', border: 'none', borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}`, padding: '16px 2px', cursor: 'pointer', textAlign: 'left', transition: 'padding-left .2s ease' }}
                onMouseOver={(e) => { e.currentTarget.style.paddingLeft = '10px' }}
                onMouseOut={(e) => { e.currentTarget.style.paddingLeft = '2px' }}>
                <Archive size={15} style={{ color: SILVER, flexShrink: 0 }} strokeWidth={1.6} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'Bebas Neue', fontSize: '20px', color: BONE, letterSpacing: '.03em', lineHeight: 1 }}>PAST EDITIONS</span>
                  <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: '4px' }}>{String(pastCount).padStart(2, '0')} nights in the archive</span>
                </span>
                <ArrowUpRight size={15} style={{ color: SILVER, flexShrink: 0 }} />
              </button>
            )}
          </>
        )}
      </div>

      {/* page-wide film grain */}
      <div style={{ position: 'absolute', inset: 0, background: GRAIN, backgroundSize: '150px 150px', opacity: 0.04, mixBlendMode: 'overlay', pointerEvents: 'none', zIndex: 20 }} />
    </div>
  )
}

/* ---- the featured room: a spread, not a card ---- */
function FeaturedRoom({ e, live, attendees, count, wide, onEnter }) {
  const cover = safeImg(e.cover_url)
  const availableTiers = (e.tiers || []).filter((t) => t.status === 'available')
  const fromPrice = availableTiers.length ? Math.min(...availableTiers.map((t) => t.price)) / 100 : null
  const facts = [
    [Calendar, fmtDate(e.event_date)],
    e.doors ? [Clock, e.doors.toUpperCase()] : null,
    (e.venue || e.city) ? [MapPin, (e.venue || e.city).toUpperCase()] : null,
  ].filter(Boolean)

  return (
    <div className="pressable" onClick={onEnter} role="button" aria-label={`Enter ${e.title}`}
      style={{ marginTop: '18px', position: 'relative', borderRadius: '20px', overflow: 'hidden', border: `1px solid rgba(242,238,230,.16)`, background: CARD, cursor: 'pointer', boxShadow: '0 18px 60px rgba(0,0,0,.45)' }}>
      {/* the banner — cover or the room's own sky */}
      <div className="disc-banner" style={{ position: 'relative', height: wide ? '340px' : '230px', overflow: 'hidden', background: VOID }}>
        {cover
          ? <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <MiniStars seed={e.slug || e.id} dense k={wide ? 0.3 : 0.6} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,8,14,.05) 20%, rgba(7,8,14,.55) 62%, rgba(9,9,14,.96) 100%)' }} />
        <span style={{ position: 'absolute', top: '14px', left: '14px', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.2em', color: BONE, border: `1px solid rgba(242,238,230,.35)`, borderRadius: '100px', padding: '4px 11px', background: 'rgba(7,8,14,.55)', textTransform: 'uppercase' }}>
          {e.edition || 'The next room'}
        </span>
        {/* identity block over a guaranteed scrim (Ley 3) */}
        <div style={{ position: 'absolute', left: wide ? '28px' : '18px', right: wide ? '28px' : '18px', bottom: wide ? '20px' : '14px' }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: SILVER, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: '8px' }}>The Collectiv4 presents</div>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? 'clamp(54px, 6vw, 84px)' : '44px', letterSpacing: '.01em', lineHeight: .88, color: BONE, textShadow: '0 2px 24px rgba(0,0,0,.6)' }}>{e.title}</div>
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
          {/* who's pulling up — real faces or the honest count (Leyes 6, 11) */}
          {attendees.length > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {attendees.slice(0, wide ? 8 : 5).map((a, i) => {
                  const src = safeImg(a.avatar_url)
                  return (
                    <span key={a.id || i} title={a.name || ''} style={{ width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden', border: `1px solid rgba(199,201,209,.5)`, background: CARD, marginLeft: i === 0 ? 0 : '-8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '10px', background: BONE, borderRadius: '11px', padding: wide ? '13px 22px' : '12px 18px', color: VOID, boxShadow: '0 4px 20px rgba(242,238,230,.14)' }}>
            <Ticket size={15} style={{ color: VOID }} />
            <span style={{ fontFamily: 'Bebas Neue', fontSize: '15px', letterSpacing: '.06em' }}>ENTER THE ROOM</span>
            {fromPrice != null && <span style={{ fontSize: '11px', color: 'rgba(10,10,13,.55)', fontWeight: 500, fontFamily: 'DM Sans' }}>from ${fromPrice}</span>}
            <ArrowRight size={13} style={{ color: VOID }} />
          </span>
        </div>
      </div>
    </div>
  )
}

/* ---- a room in the directory ---- */
function RoomCard({ e, onOpen }) {
  const cover = safeImg(e.cover_url)
  return (
    <div onClick={onOpen} className="disc-card pressable" role="button" aria-label={`Open ${e.title}`}
      style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: CARD, cursor: 'pointer' }}>
      <div className="disc-banner" style={{ position: 'relative', height: '128px', overflow: 'hidden', background: VOID }}>
        {cover ? <img src={cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MiniStars seed={e.slug || e.id} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,8,14,.1) 30%, rgba(7,8,14,.9) 100%)' }} />
        {e.edition && (
          <span style={{ position: 'absolute', top: '12px', right: '12px', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.16em', color: BONE, border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '3px 9px', background: 'rgba(7,8,14,.5)', textTransform: 'uppercase' }}>{e.edition}</span>
        )}
        <div style={{ position: 'absolute', left: '16px', right: '16px', bottom: '13px' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '26px', letterSpacing: '.02em', lineHeight: .9, color: BONE }}>{e.title}</div>
        </div>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Calendar size={10} style={{ color: BONE_LOW }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_MID, letterSpacing: '.06em' }}>{fmtDate(e.event_date)}</span>
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
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 90% at 30% 0%, rgba(242,238,230,.08) 0%, transparent 60%), ${VOID}` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={(s.r / 2) * k} fill={STAR} opacity={s.o} />)}
      </svg>
    </div>
  )
}
