import { Outlet, NavLink } from 'react-router-dom'
import { CalendarDays, Users, MessageCircle, User } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'

const tabs = [
  { to: '/',           icon: CalendarDays,   label: 'Event'     },
  { to: '/attendees',  icon: Users,          label: 'Going'     },
  { to: '/chat',       icon: MessageCircle,  label: 'Chat'      },
  { to: '/profile',    icon: User,           label: 'Profile'   },
]

export default function Layout() {
  const { user } = useAuth()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0E0D0B' }}>
      <main style={{ flex: 1, paddingBottom: user ? '72px' : '0px', overflowY: 'auto' }}>
        <Outlet />
      </main>
      {user && (
        <nav style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: '430px',
          background: 'rgba(14,13,11,0.95)', backdropFilter: 'blur(12px)',
          borderTop: '1px solid #2A2825',
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          height: '64px', zIndex: 100, padding: '0 8px'
        }}>
          {tabs.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '3px', textDecoration: 'none', padding: '8px 12px',
              color: isActive ? '#C05A2A' : '#5A5248',
              transition: 'color 0.2s'
            })}>
              <Icon size={21} strokeWidth={isActive ? 2.2 : 1.6} />
              <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
