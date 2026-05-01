import { Outlet, NavLink } from 'react-router-dom'
import { Home, Map, Users, MessageCircle, User } from 'lucide-react'

const tabs = [
  { to: '/',        icon: Home,          label: 'Home'     },
  { to: '/map',     icon: Map,           label: 'Map'      },
  { to: '/connect', icon: Users,         label: 'Connect'  },
  { to: '/messages',icon: MessageCircle, label: 'Messages' },
  { to: '/profile', icon: User,          label: 'Profile'  },
]

export default function Layout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0E0D0B' }}>
      <main style={{ flex: 1, paddingBottom: '72px', overflowY: 'auto' }}>
        <Outlet />
      </main>
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px',
        background: '#0E0D0B', borderTop: '1px solid #2A2825',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        height: '64px', zIndex: 100, padding: '0 8px'
      }}>
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '2px', textDecoration: 'none', padding: '8px 12px',
            color: isActive ? '#C05A2A' : '#9A9288',
            transition: 'color 0.15s'
          })}>
            <Icon size={22} />
            <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.05em' }}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
