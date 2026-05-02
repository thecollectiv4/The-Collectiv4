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
      <main style={{ flex:1, paddingBottom: user ? '72px' : '0' }}>
        <Outlet />
      </main>
      {user && (
        <nav style={{
          position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
          width:'100%', maxWidth:'430px',
          background:'#0D0A04',
          borderTop:'1px solid rgba(255,255,255,.12)',
          boxShadow:'0 -8px 32px rgba(0,0,0,.8)',
          display:'flex', justifyContent:'space-around', alignItems:'center',
          height:'72px', zIndex:100,
          paddingBottom:'env(safe-area-inset-bottom, 0px)',
        }}>
          {tabs.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to==='/'} style={{textDecoration:'none'}}>
              {({ isActive }) => (
                <div style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:'5px',
                  padding:'8px 18px',
                  color: isActive ? '#FFFFFF' : '#8A7A68',
                  transition:'all 0.2s',
                  position:'relative',
                }}>
                  {isActive && <div style={{position:'absolute',top:'-1px',left:'50%',transform:'translateX(-50%)',width:'28px',height:'2px',background:'#FFFFFF'}} />}
                  <div style={{
                    width:'36px', height:'36px', borderRadius:'10px',
                    background: isActive ? 'rgba(255,255,255,.1)' : 'transparent',
                    border: isActive ? '1px solid rgba(255,255,255,.15)' : '1px solid transparent',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'all 0.2s',
                  }}>
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 1.6} />
                  </div>
                  <span style={{ fontSize:'9px', fontWeight:isActive?700:500, letterSpacing:'0.08em', textTransform:'uppercase' }}>{label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
