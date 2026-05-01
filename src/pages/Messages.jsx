import { MessageCircle, Search } from 'lucide-react'

const MOCK_THREADS = [
  { id: 1, name: 'Marcus Reyes', last: 'Bro that set was fire last night', time: '2m', unread: 2, type: 'direct' },
  { id: 2, name: 'Ran By Artists — May', last: 'Lineup confirmed, hype is building', time: '15m', unread: 5, type: 'event' },
  { id: 3, name: 'Who is pulling up to Space?', last: 'I am in, bringing 3 people', time: '1h', unread: 0, type: 'move' },
  { id: 4, name: 'Jasmine Vega', last: 'Send me the brief and I will quote you', time: '3h', unread: 0, type: 'booking' },
  { id: 5, name: 'HTX Creatives Group', last: 'Anyone doing the art pop-up Saturday?', time: '5h', unread: 1, type: 'community' },
]

const TYPE_COLORS = { direct: '#C05A2A', event: '#4A3A8A', move: '#2E6B3A', booking: '#8A5A2A', community: '#8A2A5A' }

export default function Messages() {
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.8rem', letterSpacing: '0.05em', color: '#F4F0E8', marginBottom: '1rem' }}>
        <span style={{ color: '#C05A2A' }}>MESSAGES</span>
      </div>

      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9A9288' }} />
        <input placeholder="Search messages..." style={{ width: '100%', background: '#1A1814', border: '1px solid #2A2825', borderRadius: 10, padding: '10px 14px 10px 36px', color: '#F4F0E8', fontFamily: 'DM Sans', fontSize: '0.875rem', outline: 'none' }} />
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', overflowX: 'auto' }}>
        {['All', 'Direct', 'Events', 'Moves', 'Communities'].map(t => (
          <button key={t} style={{ background: t === 'All' ? '#C05A2A' : 'transparent', border: `1px solid ${t === 'All' ? '#C05A2A' : '#2A2825'}`, borderRadius: 20, padding: '4px 14px', fontSize: '0.72rem', color: t === 'All' ? '#F4F0E8' : '#9A9288', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'DM Sans' }}>{t}</button>
        ))}
      </div>

      {MOCK_THREADS.map(thread => (
        <div key={thread.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 0', borderBottom: '1px solid #1A1814', cursor: 'pointer' }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: TYPE_COLORS[thread.type] || '#C05A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: '1.2rem', color: '#F4F0E8', flexShrink: 0 }}>
            {thread.name[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#F4F0E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.name}</div>
              <div style={{ fontSize: '0.68rem', color: '#9A9288', flexShrink: 0, marginLeft: 8 }}>{thread.time}</div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9A9288', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.last}</div>
          </div>
          {thread.unread > 0 && (
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#C05A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#F4F0E8', fontWeight: 600, flexShrink: 0 }}>{thread.unread}</div>
          )}
        </div>
      ))}
    </div>
  )
}
