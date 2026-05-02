import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, Users, User } from 'lucide-react'
import { useRef, useEffect, useState } from 'react'

const tabs = [
  { to: '/',          icon: CalendarDays,  label: 'Event',     idx: 0 },
  { to: '/community', icon: Users,         label: 'Community', idx: 1 },
  { to: '/profile',   icon: User,          label: 'Profile',   idx: 2 },
]

function NavTab({ to, icon: Icon, label, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
      padding:'4px 20px', cursor:'pointer',
      color: active ? '#F2E6D0' : '#686058',
      WebkitTapHighlightColor:'transparent',
      transition:'color 0.2s',
    }}>
      <Icon size={22} strokeWidth={active ? 2.2 : 1.4} />
      <span style={{ fontSize:'10px', fontWeight: active ? 700 : 500, letterSpacing:'0.06em', textTransform:'uppercase' }}>{label}</span>
    </div>
  )
}

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const prevIdx = useRef(0)
  const [transClass, setTransClass] = useState('page-transition')

  // Determine current tab index
  const currentIdx = tabs.findIndex(t => t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to))
  const isSubPage = currentIdx === -1 // artist profiles, experiences, etc.

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

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'var(--bg)' }}>
      <main style={{ flex:1, paddingBottom:'100px' }}>
        <div key={location.pathname} className={transClass}>
          <Outlet />
        </div>
      </main>
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0,
        background:'rgba(10,9,8,.97)',
        borderTop:'1px solid rgba(242,230,208,.08)',
        display:'flex', justifyContent:'space-around', alignItems:'center',
        zIndex:9999,
        paddingTop:'10px',
        paddingBottom:'calc(10px + env(safe-area-inset-bottom, 0px))',
      }}>
        {tabs.map(({ to, icon, label, idx }) => (
          <NavTab key={to} to={to} icon={icon} label={label}
            active={to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)}
            onClick={() => navigate(to)} />
        ))}
      </nav>
    </div>
  )
}
