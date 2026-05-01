import { useState, useEffect } from 'react'
import { db } from '@/api/supabase'
import { UserPlus, MessageCircle, Briefcase } from 'lucide-react'

function PersonCard({ profile }) {
  const [added, setAdded] = useState(false)
  return (
    <div style={{ background: '#1A1814', border: '1px solid #2A2825', borderRadius: 12, padding: '1rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#C05A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: '1.3rem', color: '#F4F0E8', flexShrink: 0 }}>
          {(profile.full_name || 'U')[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#F4F0E8' }}>{profile.full_name}</div>
          <div style={{ fontSize: '0.7rem', color: '#9A9288' }}>@{profile.username} · {profile.city}</div>
        </div>
      </div>

      {profile.roles?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.5rem' }}>
          {profile.roles.map(r => (
            <span key={r} style={{ background: '#C05A2A22', color: '#C05A2A', fontSize: '0.65rem', padding: '2px 8px', borderRadius: 20, border: '1px solid #C05A2A44' }}>{r}</span>
          ))}
        </div>
      )}

      {profile.bio && (
        <p style={{ fontSize: '0.78rem', color: '#9A9288', margin: '0 0 0.75rem', lineHeight: 1.4 }}>{profile.bio}</p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => setAdded(!added)} style={{ flex: 1, background: added ? '#C05A2A' : 'transparent', border: '1px solid #C05A2A', borderRadius: 8, padding: '7px', color: added ? '#F4F0E8' : '#C05A2A', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <UserPlus size={13} /> {added ? 'Connected' : 'Connect'}
        </button>
        <button style={{ flex: 1, background: 'transparent', border: '1px solid #2A2825', borderRadius: 8, padding: '7px', color: '#9A9288', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <MessageCircle size={13} /> Message
        </button>
        <button style={{ flex: 1, background: 'transparent', border: '1px solid #2A2825', borderRadius: 8, padding: '7px', color: '#9A9288', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Briefcase size={13} /> Book
        </button>
      </div>
    </div>
  )
}

export default function Connect() {
  const [profiles, setProfiles] = useState([])
  const [tab, setTab] = useState('for_you')

  useEffect(() => {
    db.profiles().select('*').limit(20).then(({ data }) => { if (data) setProfiles(data) })
  }, [])

  const tabs = [
    { key: 'for_you',  label: 'For You'         },
    { key: 'services', label: 'Services'         },
    { key: 'nearby',   label: 'Near You'         },
    { key: 'friends',  label: 'Friends of Friends' },
  ]

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.8rem', letterSpacing: '0.05em', color: '#F4F0E8', marginBottom: '0.25rem' }}>
        <span style={{ color: '#C05A2A' }}>CONNECT</span>
      </div>
      <div style={{ fontSize: '0.8rem', color: '#9A9288', marginBottom: '1rem' }}>Find your people in Houston</div>

      <input placeholder="Search creatives, roles, interests..." style={{ width: '100%', background: '#1A1814', border: '1px solid #2A2825', borderRadius: 10, padding: '10px 14px', color: '#F4F0E8', fontFamily: 'DM Sans', fontSize: '0.875rem', marginBottom: '0.75rem', outline: 'none' }} />

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? '#C05A2A' : 'transparent',
            border: `1px solid ${tab === t.key ? '#C05A2A' : '#2A2825'}`,
            borderRadius: 20, padding: '4px 14px', fontSize: '0.72rem',
            color: tab === t.key ? '#F4F0E8' : '#9A9288', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'DM Sans'
          }}>{t.label}</button>
        ))}
      </div>

      {profiles.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9A9288', padding: '2rem', fontSize: '0.85rem' }}>Loading creatives...</div>
      ) : (
        profiles.map(p => <PersonCard key={p.id} profile={p} />)
      )}
    </div>
  )
}
