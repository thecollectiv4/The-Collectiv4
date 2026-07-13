import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, Compass, Users, User, LayoutGrid } from 'lucide-react'
import { useRef, useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useOSAccess } from '@/lib/osAccess'
import { useIsDesktop, useWide } from '@/lib/useIsDesktop'
import AuthModal from './AuthModal'

const baseTabs = [
  { to: '/',          icon: CalendarDays,  label: 'Event',     requiresAuth: false },
  { to: '/discover',  icon: Compass,       label: 'Discover',  requiresAuth: false },
  { to: '/community', icon: Users,         label: 'Community', requiresAuth: true },
  { to: '/profile',   icon: User,          label: 'Profile',   requiresAuth: true },
]
// Network members (verified/owner) get the internal OS as an extra tab.
const osTab = { to: '/os', icon: LayoutGrid, label: 'OS', requiresAuth: true }

// Public routes never force the sign-in modal (Discover is top-of-funnel —
// and a shared world link must open the world, not a wall: /user/:id is the
// museum's public face, anon included).
const PUBLIC_PATHS = ['/', '/discover']
const isPublicPath = (path) => PUBLIC_PATHS.includes(path) || path.startsWith('/user/')

// Routes with a real desktop composition — the 430px phone frame releases
// here at >=1024px. Everything else keeps the centered phone frame under
// the wide header until it earns its own desktop architecture.
const wideDesigned = (path) =>
  path === '/' || /^\/(discover|profile|user)(\/|$)/.test(path)

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
  const autoPrompted = useRef(false)
  useEffect(() => {
    if (authLoading || autoPrompted.current) return
    // Consume the one-shot on the FIRST resolution regardless of outcome — if it
    // only armed-off when unauthenticated, a later mid-session SIGNED_OUT (cross-tab
    // sign-out, failed token refresh) would pop the modal unprompted. First-load only.
    autoPrompted.current = true
    if (!user && !isPublicPath(location.pathname)) setShowAuth(true)
  }, [authLoading, user])

  // Members (verified/owner) see the internal OS tab; everyone else sees the base four.
  const tabs = osState === 'granted' ? [...baseTabs, osTab] : baseTabs
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
      setTransClass('page-transition')
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
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'var(--bg)' }}>

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
                <button key={tab.to} onClick={()=>handleTabClick(tab)} style={{
                  background:'transparent', border:'none', cursor:'pointer',
                  padding:'8px 14px', display:'inline-flex', alignItems:'center', gap:'7px',
                  fontFamily:'DM Mono', fontSize:'10px', letterSpacing:'.18em', textTransform:'uppercase',
                  color: active ? '#F2EEE6' : '#83838F', transition:'color .2s',
                }}
                  onMouseOver={e => { if (!active) e.currentTarget.style.color = '#C7C4BC' }}
                  onMouseOut={e => { if (!active) e.currentTarget.style.color = '#83838F' }}>
                  <span aria-hidden style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#E8E9ED', boxShadow:'0 0 6px rgba(232,233,237,.6)', opacity: active ? 1 : 0, transition:'opacity .2s' }} />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </header>
      )}

      <main style={{ flex:1, paddingTop: consumerWide ? '56px' : 0, paddingBottom: (osDesktop || consumerWide) ? 0 : '100px' }}>
        {/* position+zIndex are load-bearing: while the route transition
            animates, this div is a stacking context that competes with the
            body-portaled Constellation canvas (zIndex 0) in DOM order — and
            the canvas comes later, so without an explicit z the ENTIRE page
            paints behind the sky for the length of the animation. */}
        <div key={location.pathname} className={transClass} style={{ position:'relative', zIndex:1 }}>
          <Outlet />
        </div>
      </main>

      {/* Auth Modal - shows on first load when not signed in */}
      {showAuth && !user && <AuthModal onClose={()=>{setShowAuth(false);setAuthDismissed(true)}} />}
      {/* Also show if they try to navigate without auth after dismissing */}

      {/* Nav - consumer surfaces + mobile /os; never on desktop /os or wide (the header carries it) */}
      {!osDesktop && !consumerWide && <nav style={{
        position:'fixed', bottom:0, left:0, right:0,
        background:'rgba(10,10,13,.97)',
        borderTop:'1px solid rgba(242,238,230,.08)',
        display:'flex', justifyContent:'space-around', alignItems:'center',
        zIndex:9999,
        paddingTop:'10px',
        paddingBottom:'calc(10px + env(safe-area-inset-bottom, 0px))',
      }}>
        {tabs.map((tab) => {
          const active = tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to)
          const Icon = tab.icon
          return (
            <div key={tab.to} onClick={()=>handleTabClick(tab)} style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
              padding:'4px 20px', cursor:'pointer',
              color: active ? '#F2EEE6' : '#83838F',
              WebkitTapHighlightColor:'transparent',
              transition:'color 0.2s',
            }}>
              <Icon size={22} strokeWidth={active ? 2.2 : 1.4} />
              <span style={{ fontSize:'10px', fontWeight: active ? 700 : 500, letterSpacing:'0.06em', textTransform:'uppercase' }}>{tab.label}</span>
            </div>
          )
        })}
      </nav>}
    </div>
  )
}
