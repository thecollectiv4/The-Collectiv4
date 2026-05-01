import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/api/supabase'
import { Flame, Users, Zap, Heart, Repeat2, Share2 } from 'lucide-react'

const actionCards = [
  { icon: Flame,  label: 'Find a Move', sub: 'Describe what you feel like doing today', color: '#C05A2A', path: '/find-a-move' },
  { icon: Users,  label: 'Connect',     sub: 'Find your people in Houston',              color: '#4A3A8A', path: '/connect'    },
  { icon: Zap,    label: 'Make your project a reality', sub: 'Describe your vision — we build the team', color: '#2E6B3A', path: '/connect' },
]

function PostCard({ post }) {
  const [liked, setLiked] = useState(false)
  return (
    <div style={{ background: '#1A1814', borderRadius: 12, padding: '1rem', marginBottom: '0.75rem', border: '1px solid #2A2825' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: '#C05A2A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Bebas Neue', fontSize: '1.1rem', color: '#F4F0E8', flexShrink: 0
        }}>
          {(post.author_id || '?')[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 500, fontSize: '0.85rem', color: '#F4F0E8' }}>{post.author_id?.replace('seed_', '') || 'User'}</div>
          <div style={{ fontSize: '0.7rem', color: '#9A9288' }}>Houston · {new Date(post.created_at).toLocaleDateString()}</div>
        </div>
      </div>
      <p style={{ fontSize: '0.875rem', color: '#E2DDD4', lineHeight: 1.5, margin: '0 0 0.75rem' }}>{post.content}</p>
      <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #2A2825', paddingTop: '0.75rem' }}>
        <button onClick={() => setLiked(!liked)} style={{ background: 'none', border: 'none', color: liked ? '#C05A2A' : '#9A9288', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}>
          <Heart size={14} fill={liked ? '#C05A2A' : 'none'} /> {liked ? 1 : 0}
        </button>
        <button style={{ background: 'none', border: 'none', color: '#9A9288', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}>
          <Repeat2 size={14} /> Repost
        </button>
        <button style={{ background: 'none', border: 'none', color: '#9A9288', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}>
          <Share2 size={14} /> Share
        </button>
      </div>
    </div>
  )
}

export default function Home() {
  const [posts, setPosts] = useState([])
  const [tab, setTab] = useState('for_you')
  const navigate = useNavigate()

  useEffect(() => {
    db.posts().select('*').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { if (data) setPosts(data) })
  }, [])

  const tabs = [
    { key: 'for_you', label: 'For You' },
    { key: 'friends', label: 'Friends' },
    { key: 'my_city', label: 'My City' },
    { key: 'world',   label: 'World'   },
  ]

  return (
    <div style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.8rem', letterSpacing: '0.05em', color: '#F4F0E8' }}>
          THE <span style={{ color: '#C05A2A' }}>COLLECTIV4</span>
        </div>
      </div>

      {/* Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {actionCards.map((card) => (
          <button key={card.label} onClick={() => navigate(card.path)} style={{
            background: '#1A1814', border: `1px solid ${card.color}22`,
            borderLeft: `3px solid ${card.color}`, borderRadius: 10,
            padding: '0.875rem', textAlign: 'left', cursor: 'pointer',
            gridColumn: card.label === 'Make your project a reality' ? 'span 2' : 'span 1'
          }}>
            <card.icon size={18} color={card.color} style={{ marginBottom: 6 }} />
            <div style={{ fontWeight: 500, fontSize: '0.8rem', color: '#F4F0E8', marginBottom: 2 }}>{card.label}</div>
            <div style={{ fontSize: '0.68rem', color: '#9A9288', lineHeight: 1.3 }}>{card.sub}</div>
          </button>
        ))}
      </div>

      {/* Feed */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '1rem', letterSpacing: '0.08em', color: '#9A9288', marginBottom: '0.75rem' }}>
          COLLECTIVE WORLD
        </div>
        {/* Feed tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              background: tab === t.key ? '#C05A2A' : 'transparent',
              border: `1px solid ${tab === t.key ? '#C05A2A' : '#2A2825'}`,
              borderRadius: 20, padding: '4px 14px', fontSize: '0.75rem',
              color: tab === t.key ? '#F4F0E8' : '#9A9288', cursor: 'pointer',
              whiteSpace: 'nowrap', fontFamily: 'DM Sans'
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9A9288', padding: '2rem', fontSize: '0.85rem' }}>
          Loading the feed...
        </div>
      ) : (
        posts.map(post => <PostCard key={post.id} post={post} />)
      )}
    </div>
  )
}
