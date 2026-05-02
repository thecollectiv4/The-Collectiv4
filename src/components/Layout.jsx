import { Outlet, NavLink } from 'react-router-dom'
import { CalendarDays, Users, MessageCircle, User } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'

const tabs = [
  { to: '/',          icon: CalendarDays,  label: 'Event'   },
  { to: '/attendees', icon: Users,         label: 'Going'   },
  { to: '/chat',      icon: MessageCircle, label: 'Chat'    },
  { to: '/profile',   icon: User,          label: 'Profile' },
]

export default function Layout() {
  const { user } = useAuth()
  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'var(--bg)' }}>
      <main style={{ flex:1, paddingBottom: user ? '64px' : '0' }}>
        <Outlet />
      </main>
      {user && (
        <nav style={{
          position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
          width:'100%', maxWidth:'430px',
          background:'#0D0A04', backdropFilter:'blur(20px)',
          borderTop:'2px solid var(--rust)',
          display:'flex', justifyContent:'space-around', alignItems:'center',
          height:'64px', zIndex:100,
        }}>
          {tabs.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to==='/'} style={{textDecoration:'none'}}>
              {({ isActive }) => (
                <div style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
                  padding:'8px 18px',
                  color: isActive ? 'var(--cream)' : 'var(--cream-ghost)',
                  transition:'color 0.2s',
                  position:'relative',
                }}>
                  {isActive && <div style={{position:'absolute',top:'-2px',left:'50%',transform:'translateX(-50%)',width:'24px',height:'2px',background:'var(--rust)',borderRadius:'0 0 2px 2px'}} />}
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.2} />
                  <span style={{ fontSize:'9px', fontWeight:isActive?700:500, letterSpacing:'0.1em', textTransform:'uppercase' }}>{label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
