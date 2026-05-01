import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { db } from '@/api/supabase'
import { Settings, Grid, Briefcase, Star } from 'lucide-react'

export default function Profile() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [tab, setTab] = useState('works')

  useEffect(() => {
    // Load seed profile for demo
    db.profiles().select('*').eq('username', 'patoduranc').single()
      .then(({ data }) => { if (data) setProfile(data) })
    db.posts().select('*').eq('author_id', 'seed_pato')
      .then(({ data }) => { if (data) setPosts(data) })
  }, [])

  const tabs = [
    { key: 'works',    label: 'Works',    icon: Grid      },
    { key: 'services', label: 'Services', icon: Briefcase },
    { key: 'culture',  label: 'Culture',  icon: Star      },
  ]

  const demoProfile = profile || {
    full_name: 'Pato Duran', username: 'patoduranc',
    bio: 'DJ & founder of The Collectiv4. Building the creative infrastructure Houston never had.',
    city: 'Houston', roles: ['DJ', 'Founder', 'Creative Director'],
    interests: ['House Music', 'Culture', 'Events', 'Community', 'Entrepreneurship'],
    followers: Array(847).fill(''), following: Array(312).fill(''),
  }

  return (
    <div style={{ paddingBottom: '1rem' }}>
      {/* Cover */}
      <div style={{ height: 140, background: 'linear-gradient(135deg, #1A1208, #2A1A08)', position: 'relative', borderBottom: '3px solid #C05A2A' }}>
        <button onClick={signOut} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid #2A2825', borderRadius: 8, padding: '6px 10px', color: '#9A9288', cursor: 'pointer', fontSize: '0.7rem' }}>
          Sign Out
        </button>
      </div>

      <div style={{ padding: '0 1rem' }}>
        {/* Avatar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -28, marginBottom: '0.75rem' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#C05A2A', border: '3px solid #0E0D0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: '1.8rem', color: '#F4F0E8' }}>
            P
          </div>
          <button style={{ background: 'transparent', border: '1px solid #C05A2A', borderRadius: 8, padding: '7px 16px', color: '#C05A2A', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans' }}>
            Edit Profile
          </button>
        </div>

        {/* Info */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.4rem', letterSpacing: '0.04em', color: '#F4F0E8' }}>{demoProfile.full_name}</div>
          <div style={{ fontSize: '0.78rem', color: '#9A9288', marginBottom: '0.5rem' }}>@{demoProfile.username} · {demoProfile.city}</div>
          <p style={{ fontSize: '0.82rem', color: '#E2DDD4', lineHeight: 1.5, margin: '0 0 0.75rem' }}>{demoProfile.bio}</p>
        </div>

        {/* Roles */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
          {demoProfile.roles?.map(r => (
            <span key={r} style={{ background: '#C05A2A22', color: '#C05A2A', fontSize: '0.68rem', padding: '3px 10px', borderRadius: 20, border: '1px solid #C05A2A44' }}>{r}</span>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #2A2825' }}>
          {[
            { label: 'Followers', val: demoProfile.followers?.length || 847 },
            { label: 'Following', val: demoProfile.following?.length || 312 },
            { label: 'Events',    val: 4 },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.4rem', color: '#F4F0E8' }}>{s.val}</div>
              <div style={{ fontSize: '0.65rem', color: '#9A9288', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, background: tab === t.key ? '#C05A2A' : 'transparent', border: `1px solid ${tab === t.key ? '#C05A2A' : '#2A2825'}`, borderRadius: 8, padding: '8px 4px', color: tab === t.key ? '#F4F0E8' : '#9A9288', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'works' && (
          <div>
            {posts.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9A9288', padding: '2rem', fontSize: '0.85rem' }}>No works yet</div>
            ) : posts.map(p => (
              <div key={p.id} style={{ background: '#1A1814', border: '1px solid #2A2825', borderRadius: 10, padding: '0.875rem', marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.82rem', color: '#E2DDD4', margin: 0, lineHeight: 1.5 }}>{p.content}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'services' && (
          <div style={{ background: '#1A1814', border: '1px solid #2A2825', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontWeight: 500, color: '#F4F0E8', marginBottom: 4 }}>DJ Sets & Event Curation</div>
            <div style={{ fontSize: '0.75rem', color: '#9A9288', marginBottom: 8 }}>DJ sets, event programming, and creative direction for cultural events.</div>
            <div style={{ color: '#C05A2A', fontFamily: 'Bebas Neue', fontSize: '1.1rem' }}>$250/hr</div>
          </div>
        )}

        {tab === 'culture' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {demoProfile.interests?.map(i => (
              <span key={i} style={{ background: '#1A1814', border: '1px solid #2A2825', color: '#E2DDD4', fontSize: '0.72rem', padding: '4px 12px', borderRadius: 20 }}>{i}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
