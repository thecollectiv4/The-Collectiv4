import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useRef, useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useOSAccess } from '@/lib/osAccess'
import { signalsUnread, SIGNALS_EVENT } from '@/lib/signals'
import { supabase } from '@/api/supabase'
import { useIsDesktop, useWide } from '@/lib/useIsDesktop'
import AuthModal from './AuthModal'
import CreateCentral from './CreateCentral'
import GlassNav from './GlassNav'
import Mark from './Mark'
import Atmosphere, { CosmosProvider, Grain } from './Atmosphere'
import { BUBBLE, WELL, BONE_GLOW } from '@/lib/glass'

/* The re-architecture (D1, decisión de Pato — LOCKED): EVENT = solo
   eventos (the directory of rooms), COMMUNITY = solo personas, MESSAGES =
   the conversations (D2), PROFILE = your world. Discover dissolved into
   the first two. Each tab carries its icon AND its word (Leyes 5, 13).
   v5 (D3): the icons are the house's OWN star-chart marks — ✕ the night,
   ○ the circle of people, ◇ the signal, ● the self, △ the instrument —
   an icon system that is brand, not stock pictograms (Ley 14).
   v11: the bar is FIVE fixed slots and cannot reflow — OS left the tab row
   and now lives as a founder-only door on the Profile screen. /os is still a
   route; it just stopped being a public-facing tab. */
const tabs = [
  { to: '/',          mark: 'cross',   label: 'Event',     requiresAuth: false },
  { to: '/community', mark: 'ring',    label: 'Community', requiresAuth: false },
  { to: '/messages',  mark: 'diamond', label: 'Messages',  requiresAuth: true },
  { to: '/profile',   mark: 'dot',     label: 'Profile',   requiresAuth: true },
]

// Public routes never force the sign-in modal (Event + Community are
// top-of-funnel — and a shared world link must open the world, not a wall:
// /user/:id is the museum's public face, anon included; /e/:slug is any
// event's public room; /c4 is the HOUSE world — the flagship front door
// when the domain points here, so a wall there would defeat its purpose).
const PUBLIC_PATHS = ['/', '/community', '/c4']
const isPublicPath = (path) => PUBLIC_PATHS.includes(path) || path.startsWith('/user/') || path.startsWith('/e/')

// Routes with a real desktop composition — the 430px phone frame releases
// here at >=1024px. Everything else keeps the centered phone frame under
// the wide header until it earns its own desktop architecture. /e/:slug
// renders the same EventShow spread the old landing wore.
const wideDesigned = (path) =>
  path === '/' || /^\/(community|messages|profile|user|e|c4)(\/|$)/.test(path)

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { state: osState } = useOSAccess()
  const isDesktop = useIsDesktop()
  const prevIdx = useRef(0)
  const [transClass, setTransClass] = useState('page-transition')
  // Don't auto-open the sign-in modal when landing on a public route — and never
  // while the session is still rehydrating. On a hard load `user` is null until
  // getSession() resolves; computing showAuth from that flashed the modal at
  // signed-in members. Auto-open only once, on a CONFIRMED unauthenticated state.
  const [showAuth, setShowAuth] = useState(false)
  const [authDismissed, setAuthDismissed] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const autoPrompted = useRef(false)

  // CREATE — the + at the center of the app (Ley 13). Signed-out taps meet
  // the door, not a dead button; signed-in taps open the intentions.
  const openCreate = () => {
    if (authLoading) return
    if (!user) { setShowAuth(true); return }
    setCreateOpen(true)
  }
  useEffect(() => {
    if (authLoading || autoPrompted.current) return
    // Consume the one-shot on the FIRST resolution regardless of outcome — if it
    // only armed-off when unauthenticated, a later mid-session SIGNED_OUT (cross-tab
    // sign-out, failed token refresh) would pop the modal unprompted. First-load only.
    autoPrompted.current = true
    if (!user && !isPublicPath(location.pathname)) setShowAuth(true)
  }, [authLoading, user])

  // D4 retention heartbeat: one honest ping per authed session (the RPC is
  // idempotent — one row per profile per day; demo/purged never inflate it,
  // enforced server-side). Pinned to auth.uid(); fires once when identity
  // resolves, never for anon. Fire-and-forget — never blocks the UI.
  useEffect(() => {
    if (authLoading || !user) return
    supabase.rpc('log_return', { p_surface: location.pathname.slice(0, 40) }).then(() => {}, () => {})
  }, [authLoading, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // LAS CAMPANAS (v10 D2): the bell count on the Messages mark — the ONE
  // living thing the stream puts on this screen. Refreshes on navigation
  // and whenever a surface announces a change; 0 on any failure (a badge
  // never invents). Anon carries no bell.
  const [bellCount, setBellCount] = useState(0)
  useEffect(() => {
    if (authLoading || !user) { setBellCount(0); return undefined }
    let alive = true
    const refresh = () => signalsUnread().then((n) => { if (alive) setBellCount(n) })
    refresh()
    window.addEventListener(SIGNALS_EVENT, refresh)
    return () => { alive = false; window.removeEventListener(SIGNALS_EVENT, refresh) }
  }, [authLoading, user, location.pathname])

  // The tab row is the same four for everyone now (v11) — nothing about who
  // you are can change its shape, so it can never reflow under your thumb.
  const currentIdx = tabs.findIndex(t => t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to))
  const isSubPage = currentIdx === -1

  useEffect(() => {
    if (isSubPage) {
      setTransClass('page-slide-right')
    } else if (currentIdx > prevIdx.current) {
      setTransClass('page-slide-right')
    } else if (currentIdx < prevIdx.current) {
      setTransClass('page-slide-left')
    } else {
      setTransClass('')            // same tab (e.g. /messages → /messages/:id): no page animation
    }
    if (!isSubPage) prevIdx.current = currentIdx
  }, [location.pathname])

  const handleTabClick = (tab) => {
    // Only gate tabs that actually require auth; public tabs navigate freely.
    // While auth is still resolving, navigate optimistically — the target page's
    // own three-way guard settles it (an unresolved identity is not "signed out").
    if (tab.requiresAuth && !authLoading && !user) {
      setShowAuth(true)
    } else {
      navigate(tab.to)
    }
  }

  // WORK surfaces are fluid from 768px up: /os runs its own instrument shell
  // (left rail inside the page) — the consumer bottom tab bar must not render
  // there, and the global 430px phone frame (body max-width) is released while
  // inside. Below 768px, /os keeps the phone pattern like every other tab.
  // (DESKTOP_QUERY lives in useIsDesktop.js — half-screen windows count.)
  const osDesktop = isDesktop && location.pathname.startsWith('/os')
  useEffect(() => {
    document.body.classList.toggle('os-full', osDesktop)
    return () => document.body.classList.remove('os-full')
  }, [osDesktop])

  // CONSUMER wide mode (>=1024px): a top header carries the navigation and
  // the bottom phone tabs disappear — desktop stops being a stretched phone.
  // The frame itself releases only on routes with a real desktop composition.
  const wide = useWide()
  const consumerWide = wide && !location.pathname.startsWith('/os')
  const wideFull = consumerWide && wideDesigned(location.pathname)
  useEffect(() => {
    document.body.classList.toggle('wide-full', wideFull)
    return () => document.body.classList.remove('wide-full')
  }, [wideFull])

  return (
    <CosmosProvider>
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>

      {/* v8: THE atmosphere — one sky behind every room (D1). The page div
          below carries zIndex 1, so content always reads above it. Density
          and temperature resolve per route inside; a world can claim its
          own sky via useCosmosOverride. The grain rides at the very top of
          the stack — film over the whole lens, modals included. */}
      <Atmosphere />
      <Grain />

      {/* Wide header — the desktop navigation (fixed spans the viewport; the
          body frame doesn't constrain position:fixed). Bebas mark as the door
          home, DM Mono tabs, hairline below. One instrument, editorial. */}
      {consumerWide && (
        <header style={{
          position:'fixed', top:0, left:0, right:0, zIndex:9999, height:'56px',
          background:'rgba(10,10,13,.92)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
          borderBottom:'1px solid rgba(242,238,230,.08)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 clamp(24px, 4vw, 56px)',
        }}>
          <div onClick={()=>navigate('/')} style={{ display:'flex', alignItems:'baseline', gap:'10px', cursor:'pointer' }}>
            <span style={{ fontFamily:'Bebas Neue', fontSize:'18px', color:'#F2EEE6', letterSpacing:'.08em' }}>THE COLLECTIV4</span>
            <span style={{ fontFamily:'DM Mono', fontSize:'8px', color:'#5B5952', letterSpacing:'.3em', textTransform:'uppercase' }}>◇ the creative universe</span>
          </div>
          <nav style={{ display:'flex', alignItems:'center', gap:'2px' }}>
            {tabs.map((tab) => {
              const active = tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to)
              return (
                /* v11: desktop used to be the flat cousin — a bare 10px mark
                   on a transparent button, while the phone got a lit glass
                   bubble. Same recipe on both now (src/lib/glass.js), so the
                   two can't drift again: the mark rides in a real 30px box,
                   BUBBLE when you're standing in that room, WELL when you're
                   not. */
                <button key={tab.to} className="pressable" onClick={()=>handleTabClick(tab)} style={{
                  background:'transparent', border:'none', cursor:'pointer',
                  padding:'6px 12px', display:'inline-flex', alignItems:'center', gap:'9px',
                  fontFamily:'DM Mono', fontSize:'10px', letterSpacing:'.18em', textTransform:'uppercase',
                  color: active ? '#F2EEE6' : '#83838F', transition:'color .2s',
                }}
                  onMouseOver={e => { if (!active) e.currentTarget.style.color = '#C7C4BC' }}
                  onMouseOut={e => { if (!active) e.currentTarget.style.color = '#83838F' }}>
                  {/* the house mark — lit when this room is where you stand */}
                  <span style={{
                    position:'relative', display:'inline-flex', flexShrink:0,
                    alignItems:'center', justifyContent:'center',
                    width:'30px', height:'30px', borderRadius:'11px',
                    transition:'background .25s var(--ease-house), border-color .25s var(--ease-house), box-shadow .25s var(--ease-house)',
                    ...(active ? BUBBLE : WELL),
                  }}>
                    <Mark type={tab.mark} size={15} filled={active}
                      color={active ? '#F2EEE6' : '#83838F'}
                      style={{ flexShrink:0, filter: active ? BONE_GLOW : 'none', transition:'filter .2s' }} />
                    {tab.to === '/messages' && bellCount > 0 && (
                      <span data-testid="bell-badge" className="badge-in" aria-label={`${bellCount} unread signals`}
                        style={{ position:'absolute', top:'-4px', right:'-5px', minWidth:'13px', height:'13px',
                          borderRadius:'100px', background:'#F2EEE6', color:'#0A0A0D', fontFamily:'DM Mono',
                          fontSize:'8px', fontWeight:700, lineHeight:'13px', textAlign:'center', padding:'0 3px', letterSpacing:0,
                          boxShadow:'0 0 0 2px rgba(12,12,17,.65)' }}>
                        {bellCount > 9 ? '9+' : bellCount}
                      </span>
                    )}
                  </span>
                  {tab.label}
                </button>
              )
            })}
            {/* CREATE — present in the instrument, one clear door (Ley 13) */}
            <button className="pressable" onClick={openCreate} aria-label="Create"
              style={{ marginLeft:'12px', display:'inline-flex', alignItems:'center', gap:'8px',
                borderRadius:'100px', padding:'8px 17px', color:'#F2EEE6',
                fontFamily:'DM Mono', fontSize:'10px', letterSpacing:'.18em',
                textTransform:'uppercase', cursor:'pointer',
                transition:'box-shadow .25s var(--ease-house), border-color .25s var(--ease-house)',
                ...BUBBLE,
              }}
              onMouseOver={e => { e.currentTarget.style.boxShadow = `${BUBBLE.boxShadow}, 0 0 18px rgba(242,238,230,.14)`; e.currentTarget.style.borderColor='rgba(242,238,230,.78)' }}
              onMouseOut={e => { e.currentTarget.style.boxShadow = BUBBLE.boxShadow; e.currentTarget.style.borderColor='rgba(242,238,230,.58)' }}>
              <Plus size={13} strokeWidth={2} /> Create
            </button>
          </nav>
        </header>
      )}

      {/* v11: the bar FLOATS now, and it sits 28px up so it clears the band
          iOS Safari reserves for re-expanding its collapsed toolbar. The
          runway under the page tracks that offset — it has to clear the slab,
          the 28px gap AND the home indicator. Derived from GlassNav's
          DOCK_BOTTOM; if that moves, this moves with it. */}
      <main style={{ flex:1, paddingTop: consumerWide ? '56px' : 0,
        paddingBottom: (osDesktop || consumerWide) ? 0 : 'calc(120px + env(safe-area-inset-bottom, 0px))' }}>
        {/* position+zIndex are load-bearing: the shared Atmosphere sits at
            zIndex 0 — the page lifts itself one layer above the sky, and
            the sky shows through wherever the page leaves void. */}
        <div key={location.pathname} className={transClass} style={{ position:'relative', zIndex:1 }}>
          <Outlet />
        </div>
      </main>

      {/* Auth Modal - shows on first load when not signed in */}
      {showAuth && !user && <AuthModal onClose={()=>{setShowAuth(false);setAuthDismissed(true)}} />}
      {/* Also show if they try to navigate without auth after dismissing */}

      {/* Nav - consumer surfaces + mobile /os; never on desktop /os or wide (the header carries it).
          v11: the bar is now GlassNav — same tabs, same destinations, same
          handlers, same CREATE-at-the-geometric-center split (Ley 13). Only
          the skin moved out of this file. */}
      {!osDesktop && !consumerWide && (
        <GlassNav tabs={tabs} currentIdx={currentIdx} bellCount={bellCount}
          onTab={handleTabClick} onCreate={openCreate} />
      )}

      {/* CREATE — the intentions behind the + (only what you can do TODAY) */}
      {createOpen && user && (
        <CreateCentral user={user} isMemberVerified={osState === 'granted'} onClose={()=>setCreateOpen(false)} />
      )}
    </div>
    </CosmosProvider>
  )
}
