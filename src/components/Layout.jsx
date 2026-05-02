import { Outlet, NavLink } from 'react-router-dom'
import { CalendarDays, Users, User } from 'lucide-react'

const tabs = [
  { to: '/',          icon: CalendarDays,  label: 'Event'     },
  { to: '/community', icon: Users,         label: 'Community' },
  { to: '/profile',   icon: User,          label: 'Profile'   },
]

export default function Layout() {
  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'var(--bg)' }}>
      <main style={{ flex:1, paddingBottom:'100px' }}>
        <Outlet />
      </main>
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0,
        background:'rgba(10,9,8,.97)',
        borderTop:'1px solid rgba(242,230,208,.08)',
        display:'flex', justifyContent:'space-around', alignItems:'center',
        zIndex:9999,
        paddingTop:'10px',
        paddingBottom:'calc(10px + env(safe-area-inset-bottom, 0px))',
        WebkitBackdropFilter:'blur(20px)',
        backdropFilter:'blur(20px)',
      }}>
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to==='/'} style={{textDecoration:'none',WebkitTapHighlightColor:'transparent'}}>
            {({ isActive }) => (
              <div style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
                padding:'4px 20px',
                color: isActive ? '#F2E6D0' : '#686058',
              }}>
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.4} />
                <span style={{ fontSize:'10px', fontWeight:isActive?700:500, letterSpacing:'0.06em', textTransform:'uppercase' }}>{label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
