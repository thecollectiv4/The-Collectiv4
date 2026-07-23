import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { isOwnerFounder } from '@/lib/osAccess'
import { useWide } from '@/lib/useIsDesktop'
import ForYou from '@/components/ForYou'
import { fetchFollowingSet } from '@/lib/social'
import SeedPill, { SEED_BORDER } from '@/components/SeedMark'
import CraftsSheet from '@/components/CraftsSheet'
import { VOCAB } from '@/lib/socialVocab'
import { fetchCraftsForProfiles, categoryMeta } from '@/lib/crafts'
import Mark from '@/components/Mark'
import { MoreChip, StateChip } from '@/components/Chip'
import ConnectSheet from '@/components/ConnectSheet'
import { follow as followProfile, unfollow as unfollowProfile, startDM } from '@/lib/social'
import { Loader2, MapPin, ArrowUpRight, Eye, UserCheck, Search, X } from 'lucide-react'
import VerifiedMark from '@/components/VerifiedMark'
import { CARD_TINT, cardGlass } from '@/lib/glass'
import { tintChannel } from '@/lib/cosmos'

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

const VOID = 'var(--bg)'
const BONE = 'var(--cream)'
const BONE_MID = 'var(--cream-soft)'
const BONE_LOW = 'var(--cream-dim)'
const SILVER = 'var(--silver)'
const STAR = 'var(--star)'
/* v11: translúcida, no opaca — el vidrio de los chips necesita algo
   vivo que muestrear, y la atmósfera de la app pasa por detrás. */
const CARD = CARD_TINT
const HAIR = 'rgba(var(--ink-rgb),0.08)'
const HAIR_HI = 'rgba(var(--ink-rgb),0.15)'
const CHROME = 'var(--chrome)' // deck formula — jewelry, one moment per screen (v8 D3)
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
  /* v16 — el modal murió: anon cae en /auth pantalla completa con ?next de
     vuelta exacta (la misma puerta que ya usaba el flujo de follow del
     perfil). El next lleva el estado real de esta sala (view/craft/city). */
  const goAuth = (next) =>
    navigate('/auth?next=' + encodeURIComponent(next || (window.location.pathname + window.location.search)))
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
  // v12: el perfil cuyo "+N" se está mirando (null = ninguno). Los crafts ya
  // están cargados en craftsByProfile, así que abrirlo no pide nada a la red.
  const [craftsFor, setCraftsFor] = useState(null)
  // v12.3 — la persona con la que se está abriendo la interfaz de conexión
  const [connectFor, setConnectFor] = useState(null)

  /* LAS TRES ACCIONES DE LA TARJETA.
     Anónimo no rebota contra un botón muerto: cae en la puerta de auth, que
     es la misma regla que ya usa el resto de la app (Ley 9 — una invitación,
     nunca un muro sin explicación).

     FOLLOW es optimista (se pinta antes de que el servidor conteste y se
     revierte si falla): es un gesto de un toque y esperar 300ms a que se
     encienda lo hace sentir roto. CONNECT no es optimista — abre una hoja y
     ahí el estado real se lee del servidor. */
  const onToggleFollow = async (c) => {
    if (!user) { goAuth(); return }
    const was = followingSet.has(c.id)
    setFollowingSet((s) => { const n = new Set(s); was ? n.delete(c.id) : n.add(c.id); return n })
    try {
      if (was) await unfollowProfile(user.id, c.id)
      else await followProfile(user.id, c.id)
    } catch {
      setFollowingSet((s) => { const n = new Set(s); was ? n.add(c.id) : n.delete(c.id); return n })
    }
  }

  /* MESSAGE = SÓLO abrir el chat directo (decisión de Diego: message y
     connect son dos cosas distintas). Sin intención, sin hoja: el hilo. */
  const onMessage = async (c) => {
    if (!user) { goAuth(); return }
    try { navigate(`/messages/${await startDM(c.id)}`) }
    catch { navigate('/messages') }   // el hilo no se pudo abrir → la bandeja, nunca una pantalla muerta
  }

  const onConnect = (c) => {
    if (!user) { goAuth(); return }
    setConnectFor(c)
  }

  // discovery cascades ONCE — the first data landing staggers; every refilter
  // after that crossfades as one grid, never a per-card re-dance (plan 009).
  // `entered` is STATE on a timer, not a ref flipped on first render: crafts/
  // follows land right after the profiles and re-render mid-cascade — a ref
  // flip stripped .card-in at that instant and cut the cascade to nothing.
  // 950ms = last delay (8×50) + --dur-slow (500) + margin; by then the
  // animation is done and removing the class changes nothing visually.
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (loading || entered) return
    const t = setTimeout(() => setEntered(true), 950)
    return () => clearTimeout(t)
  }, [loading, entered])

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
      const FIELDS = 'id,full_name,username,discipline,city,avatar_url,cover_url,tagline,verified,taste,media,photos_completed_at'
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
      /* v16 — LA REGLA DE ORDEN (0054, decisión de fundador): los mundos con
         avatar Y portada van SIEMPRE arriba, ordenados por cuándo
         completaron sus fotos (photos_completed_at asc: el recién completado
         entra AL FINAL del grupo con fotos). Los sin fotos completas se
         quedan abajo en su orden actual (created_at asc, que ya trae la
         query). El sello viene del trigger de 0054 — una sola fuente, nunca
         derivado a ojo en el cliente. */
      rows = [...rows].sort((a, b) => {
        const as = a.photos_completed_at, bs = b.photos_completed_at
        if (!!as !== !!bs) return as ? -1 : 1
        if (as && bs && as !== bs) return as < bs ? -1 : 1
        return 0   // estable: dentro de cada grupo manda el orden de la query
      })
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
  // the grid re-keys on any filter change — the real filter state is city +
  // craft (URL param) + nameQ (the people search), not the plan's placeholder q.
  // firstKey pins the combo the page landed on: the refilter crossfade fires
  // only on a KEY change (a real refilter), never when the `entered` timer
  // flips on the same node (adding an animation class to an existing element
  // plays it — that would flash the grid ~1s after load for no reason).
  const filterKey = `${city}|${craft}|${nameQ}`
  const firstKey = useRef(filterKey)
  const firstView = useRef(view)   // FOR YOU⇄EVERYONE crossfades on toggle, not on landing (A-29)

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
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(var(--silver-rgb),.12)', border: `1px solid ${SILVER}`, borderRadius: '100px', padding: '6px 13px', color: BONE, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', marginBottom: '4px' }}>
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
                onClick={() => { if (key === 'foryou' && !authLoading && !user) { goAuth('/community?view=foryou'); return } setView(key) }}
                style={{ background: 'transparent', border: 'none', padding: '0 2px 10px', marginBottom: '-1px', cursor: 'pointer', fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.22em', textTransform: 'uppercase', color: on ? BONE : 'rgba(var(--silver-rgb),.45)', borderBottom: `1px solid ${on ? BONE : 'transparent'}`, transition: 'color .2s, border-color .2s' }}>
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
        ) : (
        <div key={view} className={view !== firstView.current ? 'refilter-in' : undefined}>
        {view === 'foryou' ? (
          user ? (
            <ForYou user={user} onBrainstorm={() => navigate('/profile')} onEveryone={() => setView('everyone')} />
          ) : (
            /* deep-linked anon on ?view=foryou — a sober invitation, not a wall */
            <div style={{ marginTop: '26px', padding: '44px 26px', borderRadius: '18px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(var(--silver-rgb),.05), rgba(var(--silver-rgb),.01))', textAlign: 'center' }}>
              <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase' }}>◇ matched by taste</div>
              <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '30px', letterSpacing: '.03em', lineHeight: .95, margin: '14px 0 0', color: BONE }}>A FEED THAT KNOWS YOUR TASTE</h2>
              <p style={{ fontFamily: 'DM Sans', fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, margin: '14px auto 0', maxWidth: '310px' }}>
                For you is composed from your taste, your crafts and your people — not follower counts. Sign in and the universe starts listening.
              </p>
              <button className="press-spring" onClick={() => goAuth('/community?view=foryou')} style={{ marginTop: '22px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: BONE, border: 'none', borderRadius: '100px', padding: '13px 24px', color: VOID, fontFamily: 'DM Sans', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Sign in <ArrowUpRight size={16} />
              </button>
            </div>
          )
        ) : (
        <>
        {/* find a specific person — name or @handle (v9 D1: no more luck-browse
            a 200-grid; tap a result to their world, where + CONNECT lives) */}
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
        {cityOptions.length > 0 && <FilterRow label="CITY" value={city} onChange={setCity} options={cityOptions} wide={wide} />}
        {craftOptions.length > 0 && <CraftFilterRow value={craft} onChange={setCraft} options={craftOptions} wide={wide} />}

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
          <div key={filterKey} className={filterKey !== firstKey.current ? 'refilter-in' : undefined}
            style={{ display: 'grid', gridTemplateColumns: wide ? 'repeat(auto-fill, minmax(235px, 1fr))' : 'repeat(2, 1fr)', gap: wide ? '16px' : '12px' }}>
            {shown.map((c, i) => (
              /* display:grid so the single WorldCard child stretches to the
                 row's height — the wrapper is now the grid item, and the card
                 relies on that stretch for its flex:1 body (equal-height rows) */
              <div key={c.id} className={entered ? undefined : 'card-in'}
                style={entered ? { display: 'grid' } : { display: 'grid', animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                <WorldCard c={c} crafts={craftsByProfile.get(c.id) || []} following={followingSet.has(c.id)}
                  onOpen={() => navigate('/user/' + c.id)} wide={wide} showSeed={showDemo}
                  onPickCraft={setCraft}
                  onShowCrafts={() => setCraftsFor(c)}
                  onFollow={() => onToggleFollow(c)}
                  onMessage={() => onMessage(c)}
                  onConnect={() => onConnect(c)} />
              </div>
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
                onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(var(--silver-rgb),.5)'}
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
        )}
      </div>

      {/* v16: aquí vivía el segundo render del AuthModal (con el título
          "SEE WHO SHARES YOUR TASTE"). Murió — ese headline vive ahora en
          /auth como el copy de primera visita, que es donde pertenecía. */}

      {/* el +N de una tarjeta, abierto: los crafts completos de esa persona,
          cada uno una puerta al filtro correspondiente */}
      {craftsFor && (
        <CraftsSheet wide={wide} name={craftsFor.full_name || craftsFor.username}
          crafts={craftsByProfile.get(craftsFor.id) || []}
          onPickCraft={(slug) => { setCraftsFor(null); setCraft(slug) }}
          onClose={() => setCraftsFor(null)} />
      )}

      {/* LA INTERFAZ DE CONEXIÓN (v12.3). Manda el vínculo mutuo Y abre el
          hilo con la intención adentro, así que Messages queda sincronizado
          por construcción — ver la nota larga en ConnectSheet.jsx. */}
      {connectFor && user && (
        <ConnectSheet me={user} person={connectFor} wide={wide}
          onClose={() => setConnectFor(null)} />
      )}

      {/* grain lives in the app-wide varnish now (v8: one grain, 5%, over all) */}
    </div>
  )
}

/* ---- filter chips ---- */
function FilterRow({ label, value, onChange, options, wide }) {
  const all = ['all', ...options]
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.24em', marginBottom: '9px' }}>{label}</div>
      {/* v12 desktop: WRAP, don't rail. The horizontal scroll + edge fade is
          the right pattern on a phone, but on a 1440 row it masks chips that
          would all fit behind a gesture that does not exist there — and the
          scrollbar is killed globally, so there is no affordance at all. The
          taxonomy is the discovery spine; on desktop it should be a visible
          set. Mobile keeps the rail exactly as it was. */}
      <div className={wide ? undefined : 'no-scrollbar edge-fade-r'}
        style={wide
          ? { display: 'flex', gap: '8px', flexWrap: 'wrap', paddingBottom: '2px' }
          : { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
        {all.map(opt => {
          const on = value === opt
          return (
            <button key={opt} className="pressable" onClick={() => onChange(opt)} title={opt === 'all' ? 'All' : opt} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: '100px', border: `1px solid ${on ? SILVER : HAIR_HI}`, background: on ? 'rgba(var(--silver-rgb),.10)' : 'transparent', color: on ? BONE : BONE_MID, fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.06em', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background .2s, border-color .2s, color .2s, transform .2s', maxWidth: '210px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
function CraftFilterRow({ value, onChange, options, wide }) {
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.24em', marginBottom: '9px' }}>CRAFT</div>
      {/* same rail→set change as FilterRow above; this is the row that was
          visibly clipping "Illustrator" mid-word at 1440 */}
      <div className={wide ? undefined : 'no-scrollbar edge-fade-r'}
        style={wide
          ? { display: 'flex', gap: '8px', flexWrap: 'wrap', paddingBottom: '2px' }
          : { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
        {[{ slug: 'all', name: 'All' }, ...options].map(opt => {
          const on = value === opt.slug
          const meta = opt.slug === 'all' ? { tint: '199,201,209', mark: '◇' } : categoryMeta(opt.category)
          return (
            <button key={opt.slug} className="pressable" data-testid={`craft-filter-${opt.slug}`}
              onClick={() => onChange(on && opt.slug !== 'all' ? 'all' : opt.slug)}
              style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 14px', borderRadius: '100px', border: `1px solid ${on ? `rgba(${tintChannel(meta.tint)},.6)` : HAIR_HI}`, background: on ? `rgba(${tintChannel(meta.tint)},.1)` : 'transparent', color: on ? BONE : BONE_MID, fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.06em', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background .2s, border-color .2s, color .2s, transform .2s', boxShadow: on ? `0 0 12px rgba(${tintChannel(meta.tint)},.12)` : 'none' }}>
              {on && opt.slug !== 'all' && <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '8px', color: `rgb(${tintChannel(meta.tint)})` }}>{meta.mark}</span>}
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
   `following` — the viewer already follows this world: a quiet state
   chip, information not decoration (Leyes 7, 14). Se llamaba `connected`,
   pero CONNECTED ahora nombra el vínculo MUTUO (socialVocab.js) y esto sale
   de follows, que es direccional — el nombre de la prop mentía sobre qué
   relación es. `crafts` — the real taxonomy line (primary lit), the legacy
   free text only as fallback. */
/* ═══════════════════════════════════════════════════════════════════════
   LA PORTADA DE LA TARJETA (v12.1) — y por qué esto no había cambiado.

   Diego pidió esto una ronda antes y no pasó nada. La causa no fue un CSS
   que ganara ni un rebase perdido: los tres commits que arreglaron la
   portada —7be4507 "la portada llena su sección y se disuelve hasta el
   borde de abajo", 1457663 "portada como atmósfera", 2f2512f "disolución de
   portada"— tocaron ProfileMuseum.jsx y NADA MÁS. Community nunca importó
   ese componente: dibuja su propia <WorldCard/> aquí abajo, con su propia
   franja de 92px y su propio degradado de una sola parada.

   O sea: el tratamiento de portada nunca fue una pieza compartida, así que
   mejorarlo en un lado no podía llegar al otro. Se arregló el museo tres
   veces y la tarjeta cero. Es duplicación, no un bug.

   Lo que se hace aquí es portar el tratamiento, escalado a la tarjeta:

   · LA FOTO CUBRE MÁS. Deja de ser una franja de 92px y pasa a ser una capa
     de ~172/210px que corre POR DETRÁS del nombre y del oficio. La tarjeta
     no crece ni un píxel: la franja sigue existiendo como compás (bandH),
     sólo que ahora es espacio reservado y no el recorte de la foto.
   · SE DISUELVE DE VERDAD. Máscara + velo, no un degradado a color sólido.
     La máscara hace que la foto se DESVANEZCA hacia el vidrio de la tarjeta
     en vez de quedar tapada por un rectángulo opaco — sin costura, y deja
     ver el vidrio (y el cielo) por debajo, que es lo que la tarjeta es.
   · El velo por encima es el que protege al nombre, igual que coverScrim()
     en el museo: la máscara disuelve, el velo da contraste. Dos trabajos,
     dos capas.

   ⚠ LA CLASE `disc-banner` VIAJA CON LA FOTO, NO CON LA FRANJA. index.css
   cuelga de `.disc-banner img/svg` la animación de respiración del hover; si
   la imagen sale de ese contenedor, la tarjeta deja de respirar en hover y
   nadie relaciona el síntoma con este archivo. */
/* v12.2 — LA FOTO BAJA HASTA EL BORDE DE LA CÁPSULA.
   Antes la capa medía 172/210px fijos y terminaba a ~64% de la tarjeta: se
   veía dónde se acababa la foto y empezaba la tarjeta pelada. Ahora la capa
   es `inset: 0` — o sea, EXACTAMENTE la cápsula. Los dos bordes inferiores
   quedan alineados por construcción y no por un número que hay que volver a
   afinar cada vez que la tarjeta cambia de alto (que es lo que pasó con los
   172px en cuanto una tarjeta tuvo dos líneas de oficio).
   Lo que decide dónde SE DEJA DE VER la foto es la máscara, no la altura: se
   apaga al 88% para que la franja de abajo (taste / work) quede limpia. */
/* ⚠ POR QUÉ ESTA MÁSCARA LLEGA HASTA EL 100% Y NO SE APAGA ANTES.

   Regresión que reportó Diego (v12.3): "la cover se volvió a subir". La
   estructura NO revirtió — la capa sigue en `inset:0` y llega al fondo de la
   tarjeta (medido: 294 de 296px). Lo que se movió fue ESTA máscara: en la
   ronda del contraste la dejé terminando en `transparent 88%`, lo que hace
   que la FOTO se desvanezca a la nada ~35px antes del borde y quede una
   franja lisa abajo. Eso lee, con toda razón, como "la foto está más arriba".

   El corte limpio para la legibilidad NO tiene que hacerlo la máscara — lo
   hace el SCRIM (el velo de color, que sube al 94% en su banda de texto). La
   máscara sólo decide hasta dónde EXISTE la foto, y la respuesta correcta es
   "hasta abajo": así la imagen ocupa toda la tarjeta y el velo, encima,
   garantiza que el pie se lea. Dos capas, dos trabajos — separarlos fue el
   error, juntarlos otra vez es el arreglo, y queda escrito para que no se
   vuelva a mover la máscara buscando contraste que no es su tarea. */
const CARD_COVER_MASK = `linear-gradient(180deg,
  #000 0%, #000 62%,
  rgba(0,0,0,.85) 78%,
  rgba(0,0,0,.6) 90%,
  rgba(0,0,0,.4) 100%)`
/* El velo vive en index.css porque sus α NO son simétricas entre registros —
   la razón larga (oscurecer siempre ayuda, aclarar tiene que garantizar) está
   escrita ahí junto a los valores. */
const CARD_COVER_SCRIM = 'var(--card-cover-scrim)'

function WorldCard({ c, crafts = [], following, onOpen, wide, showSeed, onPickCraft, onShowCrafts, onFollow, onMessage, onConnect }) {
  const cover = safeImg(c.cover_url)
  const avatar = safeImg(c.avatar_url)
  const name = c.full_name || 'Unnamed'
  const initial = name[0].toUpperCase()
  const tc = tasteCount(c.taste)
  const wc = Array.isArray(c.media) ? c.media.length : 0

  return (
    <div onClick={onOpen} className="disc-card pressable" role="button" tabIndex={0} aria-label={`Open ${name}'s world`}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen() } }}
      /* v11: real glass, not a painted panel. cardGlass carries the
         translucent fill AND the backdrop blur, so the star field genuinely
         reads through the card — 14px, not the bar's 28: a view shows one bar
         but a dozen of these, and the backdrop here is an almost featureless
         sky where extra radius buys nothing and costs a re-raster per card
         per frame. */
      style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${c.is_demo ? SEED_BORDER : HAIR_HI}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', ...cardGlass() }}>
      {/* LA PORTADA — capa suelta, más alta que la franja, disuelta hacia
          abajo. `disc-banner` va AQUÍ porque la respiración del hover cuelga
          de `.disc-banner img` (ver la nota larga arriba). */}
      <div className="disc-banner" aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        overflow: 'hidden', zIndex: 0, pointerEvents: 'none',
        WebkitMaskImage: CARD_COVER_MASK, maskImage: CARD_COVER_MASK,
      }}>
        {cover
          ? <img src={cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <MiniStars seed={c.id || c.username || name} />}
        <div style={{ position: 'absolute', inset: 0, background: CARD_COVER_SCRIM }} />
      </div>

      {/* EL COMPÁS — la franja sigue midiendo lo mismo que antes (el avatar y
          todo el bloque de abajo se posicionan contra ella), pero ya no
          recorta la foto: ahora es espacio reservado. Los sellos viven aquí
          y no en la capa de portada, que es aria-hidden y no recibe toques. */}
      <div style={{ position: 'relative', height: wide ? '116px' : '92px', zIndex: 2 }}>
        {/* v16 — la esquina superior derecha es el cluster de estado, en la
            MISMA posición que For You: FOLLOWING (con respaldo onPhoto, la
            pill vieja a tinta .05 era ilegible sobre portada — reporte de
            Diego) y el sello de verificación. La pill sale del renglón del
            nombre, donde apretaba el nombre y flotaba distinto en cada
            sección. */}
        <span style={{ position: 'absolute', top: '10px', right: '10px', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
          {following && (
            <StateChip label={VOCAB.followingState} mark={<UserCheck size={8} />} title={`You follow ${name}`} onPhoto />
          )}
          {/* v12: 16px was frozen at phone scale inside a card that is ~50%
              wider on desktop — the membership mark read as a speck there. */}
          {c.verified && <span title="In The Collectiv4 network" aria-label="Verified — in The Collectiv4 network" style={{ display: 'inline-flex' }}><VerifiedMark size={wide ? 20 : 16} /></span>}
        </span>
        {/* guardrail 4: the label rides is_demo itself (the ONE shared pill) —
            the query already hides seed when SHOW SEED is off, so a rendered
            seed row is always a labeled seed row */}
        {c.is_demo && (
          <span style={{ position: 'absolute', top: '9px', left: '9px', display: 'inline-flex' }}>
            <SeedPill is_demo={c.is_demo} />
          </span>
        )}
      </div>
      <div style={{ position: 'absolute', left: '12px', top: `${(wide ? 116 : 92) - 22}px`, width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${SILVER}`, background: CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(var(--shadow-rgb),.5)', zIndex: 2 }}>
        {avatar
          ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontFamily: 'Bebas Neue', fontSize: '20px', color: BONE }}>{initial}</span>}
      </div>

      {/* position+zIndex son OBLIGATORIOS aquí, no decorativos: la portada de
          arriba es `position:absolute`, y un elemento posicionado pinta por
          ENCIMA de un hermano estático posterior aunque vaya antes en el DOM.
          Sin esto el nombre y el oficio quedan debajo de la foto. */}
      <div style={{ position: 'relative', zIndex: 1, padding: '26px 13px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
          <div className="disc-name" style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '22px' : '19px', letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{name}</div>
          {/* v16: la pill FOLLOWING se mudó a la esquina superior derecha de
              la cápsula (el cluster de estado, misma posición que For You) —
              aquí apretaba el nombre y se leía mal sobre cualquier fondo. */}
        </div>
        {/* v12: el craft y el +N se pican POR SEPARADO de la tarjeta. Toda la
            tarjeta navega al mundo, así que estos dos tienen que parar la
            propagación — sin eso el click subiría y abriría el perfil en vez
            de hacer lo suyo. El +N despliega la lista completa; el craft
            filtra Community por él (la gente que comparte ese oficio). */}
        {crafts.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px', minWidth: 0, overflow: 'hidden' }}>
            {(() => { const meta = categoryMeta(crafts[0].category); return (
              <button className="pressable" data-testid={`card-craft-${crafts[0].slug}`}
                onClick={(e) => { e.stopPropagation(); onPickCraft?.(crafts[0].slug) }}
                aria-label={`See other ${crafts[0].name}s`}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', minWidth: 0,
                  fontFamily: 'DM Mono', fontSize: '8.5px', color: `rgb(${tintChannel(meta.tint)})`, letterSpacing: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{crafts[0].name}</button>
            ) })()}
            {crafts.length > 1 && (
              <MoreChip n={crafts.length - 1}
                onClick={(e) => { e.stopPropagation(); onShowCrafts?.() }}
                label={`See all ${crafts.length} crafts`} />
            )}
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
        {/* v12.3 — LAS TRES ACCIONES REEMPLAZAN A LOS CONTADORES.
            "01 TASTE · 01 WORK" era información sobre la persona en el sitio
            donde uno quiere HACER algo con la persona. Y era información
            floja: un 01 no dice nada que la tarjeta no diga ya mejor con la
            foto y el oficio. Ahora el pie de la tarjeta es lo que se puede
            hacer — seguir, escribir, conectar.

            Cada una para la propagación: la tarjeta entera navega al mundo,
            así que sin stopPropagation cualquier toque aquí abriría el perfil
            en vez de hacer lo suyo (misma razón que ya tenían los chips de
            oficio unas líneas arriba). */}
        <div style={{ display: 'flex', gap: '7px', marginTop: 'auto', paddingTop: '11px', borderTop: `1px solid ${HAIR}` }}>
          {/* Los `type` son los de Mark.jsx (plus / bubble / people), NO los
              nombres de la acción: pasé "follow"/"message"/"connect" en el
              primer intento y Mark cayó a su rombo por defecto en los TRES —
              tres íconos idénticos que no significaban nada. Un `else` que no
              avisa es un error silencioso; queda escrito para que nadie
              repita el atajo.
              Las palabras salen de VOCAB, que es la única fuente de cómo se
              nombra cada vínculo (followAction / connectVerb). */}
          <CardAction type="plus" label={following ? VOCAB.followingState : VOCAB.followAction} active={following}
            onClick={(e) => { e.stopPropagation(); onFollow?.() }} />
          <CardAction type="bubble" label="Message"
            onClick={(e) => { e.stopPropagation(); onMessage?.() }} />
          <CardAction type="people" label={VOCAB.connectVerb}
            onClick={(e) => { e.stopPropagation(); onConnect?.() }} />
        </div>
      </div>
    </div>
  )
}
/* UNA ACCIÓN DE TARJETA. Ícono arriba, palabra abajo — la palabra NO es
   opcional: un ícono solo obliga a adivinar, y la casa ya decidió hace rato
   que cada destino lleva su marca Y su palabra (Leyes 5 y 13, es la misma
   regla de la barra de navegación).

   Las tres marcas salen de Mark.jsx y no de una librería suelta:
     plus   → seguir (sumar a los tuyos)
     bubble → mensaje (el glifo universal de "algo se dijo")
     people → conectar (dos círculos que se encuentran; el solape ES la tesis)
   Mismo trazo, mismo envolvente, mismo peso: se leen como un SET porque
   están dibujadas por la misma mano.

   ⚠ `bubble` y `people` estaban marcadas en Mark.jsx como propuesta que
   "nada renderiza hasta que un fundador lo diga". Diego pidió estos íconos
   en el grammar de la casa, así que aquí empiezan a renderizarse — fuera de
   la barra, que sigue intacta. Queda anotado para Pato. */
function CardAction({ type, label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className="pressable" aria-label={label} title={label}
      style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
        padding: '8px 4px 6px', borderRadius: '9px', cursor: 'pointer',
        background: active ? 'rgba(var(--ink-rgb),.07)' : 'transparent',
        border: `1px solid ${active ? 'rgba(var(--ink-rgb),.24)' : 'transparent'}`,
        transition: 'background 180ms var(--ease-house), border-color 180ms var(--ease-house)',
      }}>
      {/* v12.4 — la palabra se cortaba ("CONNE…", "MESSA…") en un teléfono
          angosto: CONNECT es la más larga y a .13em de tracking no cabía en
          un tercio de tarjeta. Se baja el tracking a .04em y el tamaño a 7px,
          y se QUITA el ellipsis: preferir una palabra completa un punto más
          chica que media palabra con puntos suspensivos — el ellipsis en una
          etiqueta de acción lee como bug, no como diseño. A este tamaño las
          tres entran enteras (medido). */}
      <Mark type={type} size={15} color={active ? BONE : SILVER} />
      <span style={{
        fontFamily: 'DM Mono', fontSize: '7px', letterSpacing: '.04em', textTransform: 'uppercase',
        color: active ? BONE : BONE_LOW, whiteSpace: 'nowrap', maxWidth: '100%',
      }}>{label}</span>
    </button>
  )
}

/* v13 — `Stat` (los contadores 01 TASTE / 01 WORK) se eliminó: quedó muerto
   cuando la tarjeta cambió a las tres acciones (CardAction) en v12.3. El
   barrido de bugs lo marcó — código sin llamar que el próximo lector cree
   que se usa. */

/* ---- deterministic mini star field ----
   `k` scales radii down on wide containers (StarField lesson, Ley 8). */
function MiniStars({ seed, k = 1 }) {
  const rnd = mulberry32(hash(String(seed)) + 5)
  const stars = Array.from({ length: 20 }, () => ({ x: +(rnd() * 100).toFixed(1), y: +(rnd() * 100).toFixed(1), r: +(0.6 + rnd() * 1.3).toFixed(2), o: +(0.15 + rnd() * 0.55).toFixed(2) }))
  return (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 90% at 30% 0%, rgba(var(--silver-rgb),.09) 0%, transparent 60%), ${VOID}` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={(s.r / 2) * k} fill={STAR} opacity={s.o} />)}
      </svg>
    </div>
  )
}

/* ---- honest presence-when-empty ---- */
function Empty({ title, body, cta, onCta, k }) {
  return (
    <div style={{ marginTop: '10px', padding: '40px 26px', borderRadius: '18px', border: `1px solid ${HAIR_HI}`, background: 'linear-gradient(150deg, rgba(var(--silver-rgb),.05), rgba(var(--silver-rgb),.01))', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
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
