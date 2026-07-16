import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { isOwnerFounder } from '@/lib/osAccess'
import { useWide } from '@/lib/useIsDesktop'
import ForYou from '@/components/ForYou'
import AuthModal from '@/components/AuthModal'
import { fetchFollowingSet } from '@/lib/social'
import { fetchCraftsForProfiles, categoryMeta } from '@/lib/crafts'
import { Loader2, MapPin, BadgeCheck, ArrowUpRight, Eye, UserCheck, Search, X } from 'lucide-react'

/* =========================================================================
   COMMUNITY — solo personas (D1, decisión de Pato): descubrir creativos,
   conectar, entrar a sus mundos. Discover's people function lives here
   now; the old ticket-wall + global chat page is gone (the room chat
   moved into each event, the DMs into Messages — the Base44 rebuild).

   Public, top-of-funnel. Ley 2: ¿a quién quiero conocer? Ley 6: la gente
   ES el contenido. Ley 14: the section reads cool silver — instrument
   light for finding your people.

   HONEST BY CODE: the public path filters is_demo=false. The gated
   PREVIEW toggle (network only) reveals demo worlds for the team.
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
const CHROME = 'linear-gradient(100deg,#F6F6FA 0%,#A6ABBA 26%,#FCFCFE 50%,#8E94A6 73%,#EFEFF4 100%)' // deck formula — jewelry, one moment per screen (v8 D3)
const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''
function hash(s = '') { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

// pre-0005 fallback: known demo handles (the DB is_demo flag is authoritative)
const DEMO_USERNAMES = new Set(['marcusreyes', 'jasminevcreates', 'devonmills', 'sofiamendez__', 'andrethompson', 'lilachen_film', 'djcarlosruiz', 'amaraosei'])

const tasteCount = (t) => {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return 0
  return (t.music?.length || 0) + (t.films?.length || 0) + (t.influences?.length || 0)
}

export default function Community() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const wide = useWide()
  const [searchParams, setSearchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [creatives, setCreatives] = useState([])
  const [city, setCity] = useState('all')
  // CRAFT filter (D2): real taxonomy slugs, never free-text chips — event
  // pages and worlds deep-link here (?craft=dj), the interconnection column
  const craft = searchParams.get('craft') || 'all'
  const setCraft = (slug) => {
    // touch ONLY the craft param — clearing the whole query string would
    // silently drop any other param riding the URL (review catch)
    const p = new URLSearchParams(searchParams)
    if (slug === 'all') p.delete('craft'); else p.set('craft', slug)
    setSearchParams(p, { replace: true })
  }
  // FOR YOU / EVERYONE (D2): the view rides the URL like craft does. No
  // explicit view + a craft deep-link (?craft=dj) → 'everyone', so old
  // links land on the filtered grid, never for-you; otherwise signed-in
  // defaults to the matched feed and anon to the open room.
  const viewParam = searchParams.get('view')
  const view = (viewParam === 'foryou' || viewParam === 'everyone')
    ? viewParam
    : (craft !== 'all' ? 'everyone' : (user ? 'foryou' : 'everyone'))
  const setView = (v) => {
    // mirror setCraft: touch ONLY the view param
    const p = new URLSearchParams(searchParams)
    p.set('view', v)
    setSearchParams(p, { replace: true })
  }
  // anon tapping FOR YOU meets the same door the nav's gated tabs open
  const [showAuth, setShowAuth] = useState(false)
  const [craftsByProfile, setCraftsByProfile] = useState(new Map())
  const [craftsLoaded, setCraftsLoaded] = useState(false)
  // v8 (adición C): the seed preview is no longer a per-page toggle — it's
  // governed by the founders' SHOW SEED switch in /os (default OFF) and the
  // 0033 RLS floor (verified ≠ seed access; owners only). This page only
  // shows an honest pill when the seed is deliberately visible.
  const [showDemo, setShowDemo] = useState(false)
  const [followingSet, setFollowingSet] = useState(new Set())
  // find a specific person (v9 D1) — a name/handle filter over the loaded
  // worlds, killing the luck-browse. Client-side is exact at this scale
  // (<200 total, all loaded); it upgrades to a server search when it grows.
  const [nameQ, setNameQ] = useState('')

  useEffect(() => {
    let alive = true
    let seedPref = import.meta.env?.VITE_DISCOVERY_PREVIEW === 'true'
    try { seedPref = seedPref || localStorage.getItem('c4_seed_visible') === '1' } catch { /* private mode */ }
    // assign the FULL verdict both ways — a latch that only ever set true
    // would survive an account switch mid-session (review catch)
    if (!user || !seedPref) { setShowDemo(false); return undefined }
    // display-gating only — 0033 returns zero seed rows to non-owners anyway
    isOwnerFounder().then((ok) => { if (alive) setShowDemo(!!ok) })
    return () => { alive = false }
  }, [user])

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const FIELDS = 'id,full_name,username,discipline,city,avatar_url,cover_url,tagline,verified,taste,media'
      let rows = []
      // bounded: the directory pages later — an unbounded select with jsonb
      // columns won't survive a real community (review catch)
      let q = supabase.from('profiles').select(FIELDS + ',is_demo').order('created_at', { ascending: true }).limit(200)
      if (!showDemo) q = q.eq('is_demo', false)
      const { data, error } = await q
      if (error) {
        const res = await supabase.from('profiles').select(FIELDS)
        rows = (res.data || []).map(r => ({ ...r, is_demo: DEMO_USERNAMES.has(r.username) }))
        if (!showDemo) rows = rows.filter(r => !r.is_demo)
      } else {
        rows = data || []
      }
      if (!alive) return
      setCreatives(rows)
      setLoading(false)
      // the craft spine on the cards + the filter's real vocabulary (0020)
      setCraftsLoaded(false)
      fetchCraftsForProfiles(rows.map(r => r.id)).then((m) => { if (alive) { setCraftsByProfile(m); setCraftsLoaded(true) } })
      // connected state on the cards (empty set pre-0017 / signed out)
      if (user?.id) {
        fetchFollowingSet(user.id, rows.map(r => r.id)).then((s) => { if (alive) setFollowingSet(s) })
      }
    }
    load()
    return () => { alive = false }
  }, [showDemo, user?.id])

  const cityOptions = useMemo(() => {
    const s = new Set()
    creatives.forEach(c => c.city && s.add(c.city))
    return [...s].sort()
  }, [creatives])
  // CRAFT chips come from the community's REAL crafts — curated taxonomy
  // names, never the old free-text soup ("CEO, DJ & Passionate Human")
  const craftOptions = useMemo(() => {
    const bySlug = new Map()
    craftsByProfile.forEach((list) => list.forEach((c) => { if (!bySlug.has(c.slug)) bySlug.set(c.slug, c) }))
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [craftsByProfile])

  const nq = nameQ.trim().toLowerCase()
  const shown = creatives.filter(c =>
    (city === 'all' || c.city === city) &&
    (craft === 'all' || (craftsByProfile.get(c.id) || []).some((k) => k.slug === craft)) &&
    (!nq || (c.full_name || '').toLowerCase().includes(nq) || (c.username || '').toLowerCase().includes(nq)))

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'transparent', overflowX: 'hidden' }}>
      {/* the sky is the app's shared atmosphere (v8 D1) — cool silver, medium
          register: the constellation as suggestion while you find your people */}
      <div style={{ position: 'relative', zIndex: 2, padding: wide ? '34px clamp(40px, 5vw, 76px) 70px' : '22px 22px 40px', maxWidth: wide ? '1440px' : undefined, margin: wide ? '0 auto' : undefined }}>

        {/* header (Leyes 2, 7) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: SILVER, letterSpacing: '.28em', paddingBottom: '8px' }}>◇</div>
            <div>
              <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: wide ? '.34em' : '.28em', textTransform: 'uppercase', marginBottom: '4px' }}>The people · find yours</div>
              <h1 style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '58px' : '40px', letterSpacing: '.02em', lineHeight: .85, margin: 0, ...chromeText }}>COMMUNITY</h1>
            </div>
          </div>
          {!loading && view === 'everyone' && (
            <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', paddingBottom: wide ? '7px' : '5px' }}>
              {String(shown.length).padStart(2, '0')} {shown.length === 1 ? 'world' : 'worlds'}
            </div>
          )}
          {/* honest state, not a control (v8 C): the seed shows only when the
              founder flipped SHOW SEED in /os — this pill says so and walks
              back to the switch (Ley 9: every click keeps its promise) */}
          {showDemo && (
            <button data-testid="seed-visible-pill" onClick={() => navigate('/os?tab=moderation')}
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(199,201,209,.12)', border: `1px solid ${SILVER}`, borderRadius: '100px', padding: '6px 13px', color: BONE, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all .2s', marginBottom: '4px' }}>
              <Eye size={12} /> seed visible · manage in /os
            </button>
          )}
        </div>

        {/* FOR YOU / EVERYONE — two ways into the same room (D2): the
            matched feed or the open grid. Anon tapping FOR YOU meets the
            auth door exactly like the nav's gated tabs (Ley 9). */}
        <div style={{ display: 'flex', gap: '22px', marginTop: '18px', borderBottom: `1px solid ${HAIR}` }}>
          {[['foryou', 'For You', 'foryou-toggle'], ['everyone', 'Everyone', 'everyone-toggle']].map(([key, label, tid]) => {
            const on = view === key
            return (
              <button key={key} className="pressable" data-testid={tid}
                onClick={() => { if (key === 'foryou' && !authLoading && !user) { setShowAuth(true); return } setView(key) }}
                style={{ background: 'transparent', border: 'none', padding: '0 2px 10px', marginBottom: '-1px', cursor: 'pointer', fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.22em', textTransform: 'uppercase', color: on ? BONE : 'rgba(199,201,209,.45)', borderBottom: `1px solid ${on ? BONE : 'transparent'}`, transition: 'color .2s, border-color .2s' }}>
                {label}
              </button>
            )
          })}
        </div>

        {/* while identity is UNKNOWN and no view was asked for, hold —
            defaulting on an unresolved session would flash the wrong room
            (three-way auth doctrine) */}
        {authLoading && !viewParam && craft === 'all' ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : view === 'foryou' ? (
          user ? (
            <ForYou user={user} onBrainstorm={() => navigate('/profile')} onEveryone={() => setView('everyone')} />
          ) : (
            /* deep-linked anon on ?view=foryou — a sober invitation, not a wall */
            <div style={{ marginTop: '26px', padding: '44px 26px', borderRadius: '18px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(199,201,209,.05), rgba(199,201,209,.01))', textAlign: 'center' }}>
              <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase' }}>◇ matched by taste</div>
              <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '30px', letterSpacing: '.03em', lineHeight: .95, margin: '14px 0 0', color: BONE }}>A FEED THAT KNOWS YOUR TASTE</h2>
              <p style={{ fontFamily: 'DM Sans', fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, margin: '14px auto 0', maxWidth: '310px' }}>
                For you is composed from your taste, your crafts and your people — not follower counts. Sign in and the universe starts listening.
              </p>
              <button className="pressable" onClick={() => setShowAuth(true)} style={{ marginTop: '22px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: BONE, border: 'none', borderRadius: '11px', padding: '13px 24px', color: VOID, fontFamily: 'DM Sans', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Sign in <ArrowUpRight size={16} />
              </button>
            </div>
          )
        ) : (
        <>
        {/* find a specific person — name or @handle (v9 D1: no more luck-browse
            a 200-grid; tap a result to their world, where + amigo lives) */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: '16px', maxWidth: wide ? '440px' : undefined }}>
          <Search size={14} strokeWidth={1.6} style={{ position: 'absolute', left: '13px', color: BONE_LOW, pointerEvents: 'none' }} />
          <input value={nameQ} onChange={(e) => setNameQ(e.target.value)} data-testid="community-search"
            placeholder="search people by name or @handle" aria-label="Search people by name or handle" autoComplete="off"
            style={{ width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '11px 38px 11px 36px', color: BONE, fontFamily: 'DM Sans', fontSize: '13.5px', outline: 'none' }} />
          {nameQ && (
            <button onClick={() => setNameQ('')} aria-label="Clear search" className="pressable"
              style={{ position: 'absolute', right: '8px', background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '6px', display: 'inline-flex' }}>
              <X size={14} />
            </button>
          )}
        </div>
        {/* filters — data-driven, honest: city from claimed cities, craft
            from the community's REAL crafts (the matching column, D2) */}
        {cityOptions.length > 0 && <FilterRow label="CITY" value={city} onChange={setCity} options={cityOptions} />}
        {craftOptions.length > 0 && <CraftFilterRow value={craft} onChange={setCraft} options={craftOptions} />}

        {!loading && (
          <div aria-hidden style={{ margin: '16px 0 12px', height: '1px', background: `linear-gradient(90deg,${HAIR_HI},transparent)` }} />
        )}

        {/* a craft deep-link must not flash 'NOTHING HERE YET' while the
            craft rows are still in flight (review catch) — filtering waits
            for the truth it filters on */}
        {loading || (craft !== 'all' && !craftsLoaded) ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : shown.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: wide ? 'repeat(auto-fill, minmax(235px, 1fr))' : 'repeat(2, 1fr)', gap: wide ? '16px' : '12px' }}>
            {shown.map(c => (
              <WorldCard key={c.id} c={c} crafts={craftsByProfile.get(c.id) || []} connected={followingSet.has(c.id)} onOpen={() => navigate('/user/' + c.id)} wide={wide} showSeed={showDemo} />
            ))}
            {/* a filtered list CLOSES — the void under the last card gets a
                composed, pressable seam back to everyone (panel catch, Ley 4) */}
            {craft !== 'all' && (
              <button className="pressable" data-testid="filter-close-line" onClick={() => setCraft('all')}
                style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '12px', background: 'transparent', border: 'none', borderTop: `1px solid ${HAIR}`, padding: '14px 2px 4px', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase' }}>
                  that's every {(craftOptions.find(o => o.slug === craft)?.name || craft).toLowerCase()} here
                </span>
                <span aria-hidden style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${HAIR}, transparent)` }} />
                <span style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: SILVER, letterSpacing: '.16em', textTransform: 'uppercase' }}>clear filter →</span>
              </button>
            )}
            {/* few worlds → the void invites (Leyes 4, 11) */}
            {shown.length <= 3 && city === 'all' && craft === 'all' && (
              <div className="pressable" onClick={() => navigate(user ? '/profile' : '/auth?next=/profile')} role="button" tabIndex={0} aria-label="Claim your world"
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); navigate(user ? '/profile' : '/auth?next=/profile') } }}
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
            k={wide ? 0.3 : 0.6}
            title={city !== 'all' || craft !== 'all' || nq ? 'NOTHING HERE YET' : 'THE UNIVERSE IS FORMING'}
            body={nq
              ? `No world matches “${nameQ.trim()}” yet — try a different name or their @handle.`
              : city !== 'all' || craft !== 'all'
                ? 'No worlds match this filter yet. Clear it, or be the first from here.'
                : 'No worlds have taken shape yet. Build yours — a personal museum of your sound, work and influences — and be one of the first stars in the room.'}
            cta={user ? 'Build your world' : 'Claim your world'}
            onCta={() => navigate(user ? '/profile' : '/auth?next=/profile')}
          />
        )}
        </>
        )}
      </div>

      {/* the auth door — local, exactly the Layout nav pattern */}
      {/* this door only ever opens from the For You entry — a first-touch
          invitation, never "welcome back" to someone who's never been here */}
      {showAuth && !user && <AuthModal onClose={() => setShowAuth(false)}
        signinTitle="SEE WHO SHARES YOUR TASTE" signinKicker="sign in to meet your people" />}

      {/* grain lives in the app-wide varnish now (v8: one grain, 5%, over all) */}
    </div>
  )
}

/* ---- filter chips ---- */
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

/* ---- the CRAFT filter — the taxonomy's own chips ----
   The category mark lights ONLY on the active chip (an idle ✕ category
   mark reads as a remove button it isn't — panel catch, Ley 9); the
   active chip carries a REAL × that clears it. */
function CraftFilterRow({ value, onChange, options }) {
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.24em', marginBottom: '9px' }}>CRAFT</div>
      <div className="no-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
        {[{ slug: 'all', name: 'All' }, ...options].map(opt => {
          const on = value === opt.slug
          const meta = opt.slug === 'all' ? { tint: '199,201,209', mark: '◇' } : categoryMeta(opt.category)
          return (
            <button key={opt.slug} className="pressable" data-testid={`craft-filter-${opt.slug}`}
              onClick={() => onChange(on && opt.slug !== 'all' ? 'all' : opt.slug)}
              style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 14px', borderRadius: '100px', border: `1px solid ${on ? `rgba(${meta.tint},.6)` : HAIR_HI}`, background: on ? `rgba(${meta.tint},.1)` : 'transparent', color: on ? BONE : BONE_MID, fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.06em', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .2s', boxShadow: on ? `0 0 12px rgba(${meta.tint},.12)` : 'none' }}>
              {on && opt.slug !== 'all' && <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '8px', color: `rgb(${meta.tint})` }}>{meta.mark}</span>}
              {opt.name}
              {on && opt.slug !== 'all' && <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, marginLeft: '2px' }}>×</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---- a creative's world, as a card in the sky ----
   `connected` — the viewer already follows this world: a quiet state
   chip, information not decoration (Leyes 7, 14). `crafts` — the real
   taxonomy line (primary lit), the legacy free text only as fallback. */
function WorldCard({ c, crafts = [], connected, onOpen, wide, showSeed }) {
  const cover = safeImg(c.cover_url)
  const avatar = safeImg(c.avatar_url)
  const name = c.full_name || 'Unnamed'
  const initial = name[0].toUpperCase()
  const tc = tasteCount(c.taste)
  const wc = Array.isArray(c.media) ? c.media.length : 0

  return (
    <div onClick={onOpen} className="disc-card pressable" role="button" tabIndex={0} aria-label={`Open ${name}'s world`}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen() } }}
      style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${c.is_demo && showSeed ? 'rgba(229,200,140,.4)' : HAIR_HI}`, background: CARD, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
      <div className="disc-banner" style={{ position: 'relative', height: wide ? '116px' : '92px', overflow: 'hidden', background: VOID }}>
        {cover
          ? <img src={cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <MiniStars seed={c.id || c.username || name} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,8,14,0) 30%, #0E0E13 100%)' }} />
        {c.verified && <span title="In The Collectiv4 network" aria-label="Verified — in The Collectiv4 network" style={{ position: 'absolute', top: '10px', right: '10px', display: 'inline-flex' }}><BadgeCheck size={16} style={{ color: STAR, filter: 'drop-shadow(0 0 6px rgba(232,233,237,.5))' }} /></span>}
        {/* guardrail 4 (v9 D3): every seed world is LABELED when SHOW SEED is on —
            the founder never mistakes a QA fixture for a real member */}
        {showSeed && c.is_demo && (
          <span data-testid="seed-card-badge" title="Seed world — QA fixture, invisible to the public"
            style={{ position: 'absolute', top: '9px', left: '9px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'DM Mono', fontSize: '7.5px', letterSpacing: '.18em', textTransform: 'uppercase', color: '#0A0A0D', background: 'rgba(229,200,140,.92)', borderRadius: '100px', padding: '3px 8px', fontWeight: 600 }}>
            ◇ seed
          </span>
        )}
      </div>
      <div style={{ position: 'absolute', left: '12px', top: `${(wide ? 116 : 92) - 22}px`, width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${SILVER}`, background: CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.5)', zIndex: 2 }}>
        {avatar
          ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontFamily: 'Bebas Neue', fontSize: '20px', color: BONE }}>{initial}</span>}
      </div>

      <div style={{ padding: '26px 13px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
          <div className="disc-name" style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '22px' : '19px', letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{name}</div>
          {connected && (
            <span title="You're connected" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0, fontFamily: 'DM Mono', fontSize: '7.5px', color: SILVER, letterSpacing: '.12em', border: '1px solid rgba(199,201,209,.3)', borderRadius: '100px', padding: '2px 7px' }}>
              <UserCheck size={8} /> IN
            </span>
          )}
        </div>
        {crafts.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px', minWidth: 0, overflow: 'hidden' }}>
            {(() => { const meta = categoryMeta(crafts[0].category); return (
              <span style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: `rgb(${meta.tint})`, letterSpacing: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{crafts[0].name}</span>
            ) })()}
            {crafts.length > 1 && <span style={{ fontFamily: 'DM Mono', fontSize: '7.5px', color: BONE_LOW, letterSpacing: '.1em', flexShrink: 0 }}>+{crafts.length - 1}</span>}
          </div>
        ) : c.discipline && <div style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: SILVER, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.discipline}</div>}
        {c.tagline && (
          <div className="disc-reveal" style={{ fontFamily: 'DM Sans', fontStyle: 'italic', fontSize: '11.5px', color: BONE_MID, lineHeight: 1.45, marginTop: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            “{c.tagline}”
          </div>
        )}
        {c.city && <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '8px' }}>
          <MapPin size={9} style={{ color: BONE_LOW }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW }}>{c.city}</span>
        </div>}
        {/* card anatomy parity (panel catch, Ley 4): every card closes with
            the same meter band — real stats, or the honest forming state —
            ANCHORED to the card's floor, so a shorter card in a mixed row
            never ends in a dead stretch above its own baseline. */}
        <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '10px', borderTop: `1px solid ${HAIR}` }}>
          {tc > 0 && <Stat n={tc} label="taste" />}
          {wc > 0 && <Stat n={wc} label="work" />}
          {tc === 0 && wc === 0 && (
            <span style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase' }}>◇ world forming</span>
          )}
        </div>
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

/* ---- deterministic mini star field ----
   `k` scales radii down on wide containers (StarField lesson, Ley 8). */
function MiniStars({ seed, k = 1 }) {
  const rnd = mulberry32(hash(String(seed)) + 5)
  const stars = Array.from({ length: 20 }, () => ({ x: +(rnd() * 100).toFixed(1), y: +(rnd() * 100).toFixed(1), r: +(0.6 + rnd() * 1.3).toFixed(2), o: +(0.15 + rnd() * 0.55).toFixed(2) }))
  return (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 90% at 30% 0%, rgba(199,201,209,.09) 0%, transparent 60%), ${VOID}` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={(s.r / 2) * k} fill={STAR} opacity={s.o} />)}
      </svg>
    </div>
  )
}

/* ---- honest presence-when-empty ---- */
function Empty({ title, body, cta, onCta, k }) {
  return (
    <div style={{ marginTop: '10px', padding: '40px 26px', borderRadius: '18px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(199,201,209,.05), rgba(199,201,209,.01))', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <MiniStars seed={title} k={k} />
      <div style={{ position: 'relative' }}>
        <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '30px', letterSpacing: '.03em', lineHeight: .95, margin: 0, color: BONE }}>{title}</h2>
        <p style={{ fontFamily: 'DM Sans', fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, margin: '14px auto 0', maxWidth: '320px' }}>{body}</p>
        {cta && (
          <button className="pressable" onClick={onCta} style={{ marginTop: '22px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: BONE, border: 'none', borderRadius: '11px', padding: '13px 24px', color: VOID, fontFamily: 'DM Sans', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            {cta} <ArrowUpRight size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
