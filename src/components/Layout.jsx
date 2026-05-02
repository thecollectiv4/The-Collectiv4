import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, Users, User } from 'lucide-react'
import { useRef, useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import AuthModal from './AuthModal'

const tabs = [
  { to: '/',          icon: CalendarDays,  label: 'Event',     idx: 0, requiresAuth: false },
  { to: '/community', icon: Users,         label: 'Community', idx: 1, requiresAuth: true },
  { to: '/profile',   icon: User,          label: 'Profile',   idx: 2, requiresAuth: true },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const prevIdx = useRef(0)
  const [transClass, setTransClass] = useState('page-transition')
  const [showAuth, setShowAuth] = useState(!user)
  const [authDismissed, setAuthDismissed] = useState(false)

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
    if (!user) {
      setShowAuth(true)
    } else {
      navigate(tab.to)
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'var(--bg)' }}>
      <main style={{ flex:1, paddingBottom:'100px' }}>
        <div key={location.pathname} className={transClass}>
          <Outlet />
        </div>
      </main>

      {/* Auth Modal - shows on first load when not signed in */}
      {showAuth && !user && <AuthModal onClose={()=>{setShowAuth(false);setAuthDismissed(true)}} />}
      {/* Also show if they try to navigate without auth after dismissing */}

      {/* Nav - always visible */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0,
        background:'rgba(10,9,8,.97)',
        borderTop:'1px solid rgba(242,230,208,.08)',
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
              color: active ? '#F2E6D0' : '#686058',
              WebkitTapHighlightColor:'transparent',
              transition:'color 0.2s',
            }}>
              <Icon size={22} strokeWidth={active ? 2.2 : 1.4} />
              <span style={{ fontSize:'10px', fontWeight: active ? 700 : 500, letterSpacing:'0.06em', textTransform:'uppercase' }}>{tab.label}</span>
            </div>
          )
        })}
      </nav>
    </div>
  )
}
