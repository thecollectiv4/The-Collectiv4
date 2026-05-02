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
        position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
        width:'100%', maxWidth:'430px',
        background:'rgba(10,9,8,.96)',
        borderTop:'1px solid rgba(242,230,208,.08)',
        boxShadow:'0 -8px 32px rgba(0,0,0,.7)',
        display:'flex', justifyContent:'space-around', alignItems:'center',
        zIndex:100,
        paddingTop:'8px',
        paddingBottom:'max(env(safe-area-inset-bottom, 16px), 16px)',
      }}>
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to==='/'} style={{textDecoration:'none'}}>
            {({ isActive }) => (
              <div style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:'5px',
                padding:'8px 24px',
                color: isActive ? '#F2E6D0' : '#686058',
                transition:'all 0.2s',
                position:'relative',
              }}>
                {isActive && <div style={{position:'absolute',top:'-1px',left:'50%',transform:'translateX(-50%)',width:'28px',height:'2px',background:'#F2E6D0',boxShadow:'0 0 8px rgba(242,230,208,.3)'}} />}
                <div style={{
                  width:'36px', height:'36px', borderRadius:'10px',
                  background: isActive ? 'rgba(242,230,208,.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(242,230,208,.12)' : '1px solid transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all 0.2s',
                }}>
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.4} />
                </div>
                <span style={{ fontSize:'9px', fontWeight:isActive?700:500, letterSpacing:'0.08em', textTransform:'uppercase' }}>{label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
