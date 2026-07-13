import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { isNetworkMember } from '@/lib/osAccess'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { useWide } from '@/lib/useIsDesktop'
import Constellation from '@/components/Constellation'
import { Loader2, MapPin, BadgeCheck, ArrowUpRight, Eye, Users, CalendarDays } from 'lucide-react'

/* =========================================================================
   Discover — a window into the city's creative universe (V1 pillar #3).
   Public, top-of-funnel. Browse creatives (profile-worlds) + events, filter by
   city + discipline, tap into a profile-museum. Cosmos-chrome, same universe as
   the museum.

   HONEST BY CODE: the public path filters is_demo = false — a real visitor never
   sees a seeded demo profile. A gated PREVIEW toggle (owner/team, or the
   VITE_DISCOVERY_PREVIEW env flag — never a guessable URL param) reveals demo
   worlds so the team can see the ecosystem full while building.
   ========================================================================= */

/* ---- brand palette (void · bone · chrome) ---- */
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

// safe image (http(s) or uploaded data:image only)
const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''

// deterministic star field per seed (a person's own constellation, when no cover)
function hash(s = '') { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

// the demo personas — a fallback filter so the public path stays honest even
// BEFORE migration 0005 is applied (the DB `is_demo` flag is authoritative once it is).
const DEMO_USERNAMES = new Set(['marcusreyes', 'jasminevcreates', 'devonmills', 'sofiamendez__', 'andrethompson', 'lilachen_film', 'djcarlosruiz', 'amaraosei'])

const tasteCount = (t) => {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return 0
  return (t.music?.length || 0) + (t.films?.length || 0) + (t.influences?.length || 0)
}

export default function Discover() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const live = useLiveEvent()
  const wide = useWide()                    // >=1024px: the sky opens

  const [loading, setLoading] = useState(true)
  const [creatives, setCreatives] = useState([])
  const [events, setEvents] = useState([])
  const [tab, setTab] = useState('people')
  const [city, setCity] = useState('all')
  const [discipline, setDiscipline] = useState('all')
  const [previewAvailable, setPreviewAvailable] = useState(import.meta.env?.VITE_DISCOVERY_PREVIEW === 'true')
  const [showDemo, setShowDemo] = useState(false)

  // May the signed-in user reveal demo worlds (preview mode)? Gated on the SAME
  // server verdict that protects /os — my_os_identity() (owner OR verified),
  // derived from the signed JWT server-side. No founder emails in the client
  // bundle; identity is never client-derived. (VITE_DISCOVERY_PREVIEW is a dev
  // override for local ecosystem previews.)
  useEffect(() => {
    let alive = true
    if (!user) return
    isNetworkMember().then((ok) => { if (alive && ok) setPreviewAvailable(true) })
    return () => { alive = false }
  }, [user])

  // Load creatives (honest: is_demo=false unless preview) + published events.
  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const FIELDS = 'id,full_name,username,discipline,city,avatar_url,cover_url,tagline,verified,taste,media'

      // creatives — authoritative (post-0005) path
      let rows = []
      let q = supabase.from('profiles').select(FIELDS + ',is_demo')
      if (!showDemo) q = q.eq('is_demo', false)
      const { data, error } = await q
      if (error) {
        // pre-0005 fallback: is_demo column not deployed yet → filter by known demo handles
        const res = await supabase.from('profiles').select(FIELDS)
        rows = (res.data || []).map(r => ({ ...r, is_demo: DEMO_USERNAMES.has(r.username) }))
        if (!showDemo) rows = rows.filter(r => !r.is_demo)
      } else {
        rows = data || []
      }

      const { data: ev } = await supabase
        .from('events')
        .select('id,slug,title,edition,event_date,venue,city,cover_url,status')
        .eq('status', 'published')
        .eq('is_test', false)   // never surface the hidden QA event (migration 0012)
        .order('event_date', { ascending: true })

      if (!alive) return
      setCreatives(rows)
      setEvents(ev || [])
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [showDemo])

  // Filter options derived from REAL data only (never hardcoded).
  const cityOptions = useMemo(() => {
    const s = new Set()
    creatives.forEach(c => c.city && s.add(c.city))
    events.forEach(e => e.city && s.add(e.city))
    return [...s].sort()
  }, [creatives, events])
  const disciplineOptions = useMemo(() => {
    const s = new Set()
    creatives.forEach(c => c.discipline && s.add(c.discipline))
    return [...s].sort()
  }, [creatives])

  const shownCreatives = creatives.filter(c =>
    (city === 'all' || c.city === city) &&
    (discipline === 'all' || c.discipline === discipline))
  const shownEvents = events.filter(e => city === 'all' || e.city === city)

  const count = tab === 'people' ? shownCreatives.length : shownEvents.length

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', overflowX: 'hidden' }}>
      {/* the sky itself — quiet register: the worlds are the content, the
          universe is the room they hang in (Leyes 1, 6, 8) */}
      <Constellation seed="the-creative-universe" quiet />
      <div style={{ position: 'relative', zIndex: 2, padding: wide ? '34px clamp(40px, 5vw, 76px) 70px' : '22px 22px 40px', maxWidth: wide ? '1440px' : undefined, margin: wide ? '0 auto' : undefined }}>

        {/* header — the title answers with the count beside it, one composed
            line: "¿a quién quiero conocer?" starts here (Ley 2, Ley 7) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: SILVER, letterSpacing: '.28em', paddingBottom: '8px' }}>◇</div>
            <div>
              <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: wide ? '.34em' : '.28em', textTransform: 'uppercase', marginBottom: '4px' }}>The creative universe</div>
              <h1 style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '58px' : '40px', letterSpacing: '.02em', lineHeight: .85, margin: 0, ...chromeText }}>DISCOVER</h1>
            </div>
          </div>
          {!loading && (
            <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', paddingBottom: wide ? '7px' : '5px' }}>
              {String(count).padStart(2, '0')} {tab === 'people' ? (count === 1 ? 'world' : 'worlds') : (count === 1 ? 'event' : 'events')}
            </div>
          )}
          {previewAvailable && (
            <button onClick={() => setShowDemo(v => !v)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px', background: showDemo ? 'rgba(199,201,209,.12)' : 'transparent', border: `1px solid ${showDemo ? SILVER : HAIR_HI}`, borderRadius: '100px', padding: '6px 13px', color: showDemo ? BONE : BONE_MID, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all .2s', marginBottom: '4px' }}>
              <Eye size={12} /> Preview · demo worlds {showDemo ? 'ON' : 'OFF'}
            </button>
          )}
        </div>

        {/* segmented tabs */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '14px', maxWidth: wide ? '400px' : undefined }}>
          {[['people', 'PEOPLE', Users], ['events', 'EVENTS', CalendarDays]].map(([id, label, Icon]) => {
            const on = tab === id
            return (
              <button key={id} onClick={() => setTab(id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', borderRadius: '11px', border: `1px solid ${on ? HAIR_HI : HAIR}`, background: on ? 'rgba(199,201,209,.06)' : 'transparent', cursor: 'pointer', transition: 'all .2s' }}>
                <Icon size={14} style={{ color: on ? SILVER : BONE_LOW }} strokeWidth={on ? 2 : 1.4} />
                <span style={{ fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.16em', color: on ? BONE : BONE_LOW }}>{label}</span>
              </button>
            )
          })}
        </div>

        {/* filters — data-driven, honest (only real cities/disciplines) */}
        {cityOptions.length > 0 && (
          <FilterRow label="CITY" value={city} onChange={setCity} options={cityOptions} />
        )}
        {tab === 'people' && disciplineOptions.length > 0 && (
          <FilterRow label="CRAFT" value={discipline} onChange={setDiscipline} options={disciplineOptions} />
        )}

        {/* hairline before the grid — the count already lives in the header */}
        {!loading && (
          <div aria-hidden style={{ margin: '16px 0 12px', height: '1px', background: `linear-gradient(90deg,${HAIR_HI},transparent)` }} />
        )}

        {/* content */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : tab === 'people' ? (
          shownCreatives.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: wide ? 'repeat(auto-fill, minmax(235px, 1fr))' : 'repeat(2, 1fr)', gap: wide ? '16px' : '12px' }}>
              {shownCreatives.map(c => <WorldCard key={c.id} c={c} onOpen={() => navigate('/user/' + c.id)} wide={wide} />)}
              {/* few worlds → the void composes into an invitation, not
                  abandonment (Ley 4 + Ley 11: un vacío que invita) */}
              {shownCreatives.length <= 3 && city === 'all' && discipline === 'all' && (
                <div className="pressable" onClick={() => navigate(user ? '/profile' : '/auth?next=/profile')} role="button" aria-label="Claim your world"
                  style={{ border: `1px dashed ${HAIR_HI}`, borderRadius: '16px', minHeight: wide ? '236px' : '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '9px', cursor: 'pointer', transition: 'border-color .25s ease' }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(199,201,209,.5)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = HAIR_HI}>
                  <span style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', textTransform: 'uppercase', color: BONE_LOW }}>◇ your world goes here</span>
                  <span style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID }}>claim yours →</span>
                </div>
              )}
            </div>
          ) : (
            <Empty
              title={city !== 'all' || discipline !== 'all' ? 'NOTHING HERE YET' : 'THE UNIVERSE IS FORMING'}
              body={city !== 'all' || discipline !== 'all'
                ? 'No worlds match this filter yet. Clear it, or be the first from here.'
                : 'No worlds have taken shape yet. Build yours — a personal museum of your sound, work and influences — and be one of the first stars in the room.'}
              cta={user ? 'Build your world' : 'Claim your world'}
              onCta={() => navigate(user ? '/profile' : '/auth?next=/profile')}
            />
          )
        ) : (
          shownEvents.length > 0 ? (
            <div style={{ display: wide ? 'grid' : 'flex', ...(wide ? { gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' } : { flexDirection: 'column' }), gap: wide ? '20px' : '14px' }}>
              {shownEvents.map(e => <EventCard key={e.id} e={e} live={live} onOpen={() => navigate(e.slug ? `/e/${e.slug}` : '/')} />)}
            </div>
          ) : (
            <Empty title="NO EVENTS LIVE" body="No published events right now. The next room is being built — check back soon." />
          )
        )}
      </div>

      {/* page-wide film grain */}
      <div style={{ position: 'absolute', inset: 0, background: GRAIN, backgroundSize: '150px 150px', opacity: 0.04, mixBlendMode: 'overlay', pointerEvents: 'none', zIndex: 20 }} />
    </div>
  )
}

/* ---- filter chips (horizontal, honest options) ---- */
function FilterRow({ label, value, onChange, options }) {
  const all = ['all', ...options]
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.24em', marginBottom: '9px' }}>{label}</div>
      <div className="no-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
        {all.map(opt => {
          const on = value === opt
          return (
            <button key={opt} className="pressable" onClick={() => onChange(opt)} title={opt === 'all' ? 'All' : opt} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: '100px', border: `1px solid ${on ? SILVER : HAIR_HI}`, background: on ? 'rgba(199,201,209,.10)' : 'transparent', color: on ? BONE : BONE_MID, fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.06em', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .2s', maxWidth: '210px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {opt === 'all' ? 'All' : opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---- a creative's world, as a card in the sky ----
   Hover lives in CSS (.disc-card in index.css): the card lifts, the banner
   breathes, the name goes liquid chrome, the person's line reveals. */
function WorldCard({ c, onOpen, wide }) {
  const cover = safeImg(c.cover_url)
  const avatar = safeImg(c.avatar_url)
  const name = c.full_name || 'Unnamed'
  const initial = name[0].toUpperCase()
  const tc = tasteCount(c.taste)
  const wc = Array.isArray(c.media) ? c.media.length : 0

  return (
    <div onClick={onOpen} className="disc-card pressable" style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: CARD, cursor: 'pointer' }}>
      {/* cosmic banner */}
      <div className="disc-banner" style={{ position: 'relative', height: wide ? '116px' : '92px', overflow: 'hidden', background: VOID }}>
        {cover
          ? <img src={cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <MiniStars seed={c.id || c.username || name} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,8,14,0) 30%, #0E0E13 100%)' }} />
        {c.verified && <span title="In The Collectiv4 network" aria-label="Verified — in The Collectiv4 network" style={{ position: 'absolute', top: '10px', right: '10px', display: 'inline-flex' }}><BadgeCheck size={16} style={{ color: STAR, filter: 'drop-shadow(0 0 6px rgba(232,233,237,.5))' }} /></span>}
      </div>
      {/* avatar medallion — a sibling of the banner, never clipped by its
          overflow:hidden (the banner clips so the breathe zoom stays inside) */}
      <div style={{ position: 'absolute', left: '12px', top: `${(wide ? 116 : 92) - 22}px`, width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${SILVER}`, background: CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.5)', zIndex: 2 }}>
        {avatar
          ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontFamily: 'Bebas Neue', fontSize: '20px', color: BONE }}>{initial}</span>}
      </div>

      {/* identity */}
      <div style={{ padding: '26px 13px 14px' }}>
        <div className="disc-name" style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '22px' : '19px', letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        {c.discipline && <div style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: SILVER, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.discipline}</div>}
        {c.tagline && (
          <div className="disc-reveal" style={{ fontFamily: 'DM Sans', fontStyle: 'italic', fontSize: '11.5px', color: BONE_MID, lineHeight: 1.45, marginTop: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            “{c.tagline}”
          </div>
        )}
        {c.city && <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '8px' }}>
          <MapPin size={9} style={{ color: BONE_LOW }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW }}>{c.city}</span>
        </div>}
        {(tc > 0 || wc > 0) && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${HAIR}` }}>
            {tc > 0 && <Stat n={tc} label="taste" />}
            {wc > 0 && <Stat n={wc} label="work" />}
          </div>
        )}
        {/* a bare profile is honest, not broken — say what it is (Ley 11) */}
        {!c.discipline && !c.tagline && !c.city && tc === 0 && wc === 0 && (
          <div style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: '7px' }}>world forming</div>
        )}
      </div>
    </div>
  )
}
function Stat({ n, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
      <span style={{ fontFamily: 'Bebas Neue', fontSize: '14px', color: SILVER }}>{String(n).padStart(2, '0')}</span>
      <span style={{ fontFamily: 'DM Mono', fontSize: '7.5px', color: BONE_LOW, letterSpacing: '.12em', textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}

/* ---- event card ---- */
function EventCard({ e, live, onOpen }) {
  const cover = safeImg(e.cover_url)
  const dateStr = e.event_date ? new Date(e.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() : 'TBA'
  return (
    <div onClick={onOpen} className="disc-card" style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: CARD, cursor: 'pointer' }}>
      <div className="disc-banner" style={{ position: 'relative', height: '130px', overflow: 'hidden', background: VOID }}>
        {cover ? <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MiniStars seed={e.slug || e.id} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,8,14,.1) 30%, rgba(7,8,14,.9) 100%)' }} />
        <span style={{ position: 'absolute', top: '12px', right: '12px', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.16em', color: BONE, border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '3px 9px', background: 'rgba(7,8,14,.5)' }}>UPCOMING</span>
        <div style={{ position: 'absolute', left: '16px', right: '16px', bottom: '14px' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', letterSpacing: '.02em', lineHeight: .9, color: BONE }}>{e.title}{e.edition ? ` · ${e.edition}` : ''}</div>
        </div>
      </div>
      <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_MID, letterSpacing: '.06em' }}>{dateStr}</span>
        {(e.venue || e.city) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <MapPin size={10} style={{ color: BONE_LOW }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: BONE_LOW }}>{e.venue || e.city}</span>
        </span>}
        <ArrowUpRight size={14} style={{ color: SILVER, marginLeft: 'auto' }} />
      </div>
    </div>
  )
}

/* ---- deterministic mini star field for cover-less tiles ---- */
function MiniStars({ seed }) {
  const rnd = mulberry32(hash(String(seed)) + 5)
  const stars = Array.from({ length: 20 }, () => ({ x: +(rnd() * 100).toFixed(1), y: +(rnd() * 100).toFixed(1), r: +(0.6 + rnd() * 1.3).toFixed(2), o: +(0.15 + rnd() * 0.55).toFixed(2) }))
  return (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 90% at 30% 0%, rgba(199,201,209,.09) 0%, transparent 60%), ${VOID}` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r / 2} fill={STAR} opacity={s.o} />)}
      </svg>
    </div>
  )
}

/* ---- honest presence-when-empty ---- */
function Empty({ title, body, cta, onCta }) {
  return (
    <div style={{ marginTop: '10px', padding: '40px 26px', borderRadius: '18px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(199,201,209,.05), rgba(199,201,209,.01))', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <MiniStars seed={title} />
      <div style={{ position: 'relative' }}>
        <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '30px', letterSpacing: '.03em', lineHeight: .95, margin: 0, color: BONE }}>{title}</h2>
        <p style={{ fontFamily: 'DM Sans', fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, margin: '14px auto 0', maxWidth: '320px' }}>{body}</p>
        {cta && (
          <button onClick={onCta} style={{ marginTop: '22px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: BONE, border: 'none', borderRadius: '11px', padding: '13px 24px', color: VOID, fontFamily: 'DM Sans', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            {cta} <ArrowUpRight size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
