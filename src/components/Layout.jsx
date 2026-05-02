import { Outlet, NavLink } from 'react-router-dom'
import { CalendarDays, Users, MessageCircle, User } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'

const tabs = [
  { to: '/',          icon: CalendarDays,  label: 'Event'   },
  { to: '/attendees', icon: Users,         label: 'Going'   },
  { to: '/chat',      icon: MessageCircle, label: 'Chat'    },
  { to: '/profile',   icon: User,          label: 'You'     },
]

export default function Layout() {
  const { user } = useAuth()
  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'var(--bg)' }}>
      <main style={{ flex:1, paddingBottom: user ? '56px' : '0' }}>
        <Outlet />
      </main>
      {user && (
        <nav style={{
          position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
          width:'100%', maxWidth:'430px',
          background:'rgba(13,10,4,0.94)', backdropFilter:'blur(20px)',
          borderTop:'1px solid var(--border-hi)',
          display:'flex', justifyContent:'space-around', alignItems:'center',
          height:'56px', zIndex:100,
        }}>
          {tabs.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to==='/'} style={({ isActive }) => ({
              display:'flex', flexDirection:'column', alignItems:'center', gap:'2px',
              textDecoration:'none', padding:'6px 16px',
              color: isActive ? 'var(--cream)' : 'var(--cream-low)',
              transition:'color 0.2s',
            })}>
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.4} />
              <span style={{ fontSize:'8px', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase' }}>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
