import { useState, useEffect } from 'react'
import { db } from '@/api/supabase'
import { Flame, Users, Plus, ChevronRight } from 'lucide-react'

const VIBE_TYPES = ['Club Night', 'Kickback', 'Sports', 'Food Run', 'Art', 'Music', 'Other']
const VIBE_CHIPS = ['Soccer with the boys', 'Night out', 'Chill rooftop', 'Art show', 'Food run', 'Live music', 'Kickback']

function MoveCard({ move, onJoin }) {
  const [joined, setJoined] = useState(false)
  const count = (move.attendees?.length || 0) + (joined ? 1 : 0)

  return (
    <div style={{ background: '#1A1814', border: '1px solid #2A2825', borderRadius: 12, padding: '1rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#F4F0E8', marginBottom: 4 }}>{move.title}</div>
          <div style={{ fontSize: '0.7rem', color: '#9A9288' }}>{move.location_name} · {move.time}</div>
        </div>
        <span style={{ background: '#C05A2A22', color: '#C05A2A', fontSize: '0.6rem', padding: '2px 8px', borderRadius: 20, border: '1px solid #C05A2A44', marginLeft: 8, whiteSpace: 'nowrap' }}>
          {move.vibe_type?.replace('_', ' ') || 'Move'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex' }}>
          {[...Array(Math.min(count, 4))].map((_, i) => (
            <div key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: ['#C05A2A','#4A3A8A','#2E6B3A','#8A5A2A'][i], border: '2px solid #1A1814', marginLeft: i > 0 ? -6 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: '#F4F0E8', fontWeight: 600 }}>
              {String.fromCharCode(65 + i)}
            </div>
          ))}
        </div>
        <span style={{ fontSize: '0.72rem', color: '#9A9288' }}>{count} going</span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => setJoined(!joined)} style={{
          flex: 1, background: joined ? '#C05A2A' : 'transparent',
          border: '1px solid #C05A2A', borderRadius: 8, padding: '8px',
          color: joined ? '#F4F0E8' : '#C05A2A', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans'
        }}>
          {joined ? "I'm In ✓" : "I'm In"}
        </button>
        <button style={{ flex: 1, background: 'transparent', border: '1px solid #2A2825', borderRadius: 8, padding: '8px', color: '#9A9288', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'DM Sans' }}>
          View Move
        </button>
      </div>
    </div>
  )
}

export default function FindAMove() {
  const [moves, setMoves] = useState([])
  const [tab, setTab] = useState('for_you')
  const [vibe, setVibe] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    db.moves().select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setMoves(data) })
  }, [])

  const tabs = [
    { key: 'for_you',  label: 'For You'       },
    { key: 'friends',  label: "Friends' Moves" },
    { key: 'venues',   label: 'Venue Moves'    },
    { key: 'my_moves', label: 'My Moves'       },
  ]

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.8rem', letterSpacing: '0.05em', color: '#F4F0E8', marginBottom: '0.25rem' }}>
        FIND A <span style={{ color: '#C05A2A' }}>MOVE</span>
      </div>
      <div style={{ fontSize: '0.8rem', color: '#9A9288', marginBottom: '1rem' }}>Describe what you feel like doing today</div>

      {/* Prompt bar */}
      <div style={{ background: '#1A1814', border: '1px solid #2A2825', borderRadius: 12, padding: '0.75rem', marginBottom: '0.75rem' }}>
        <input
          value={vibe}
          onChange={e => setVibe(e.target.value)}
          placeholder="What are you feeling today?"
          style={{ width: '100%', background: 'none', border: 'none', color: '#F4F0E8', fontSize: '0.875rem', fontFamily: 'DM Sans', outline: 'none' }}
        />
      </div>

      {/* Vibe chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {VIBE_CHIPS.map(chip => (
          <button key={chip} onClick={() => setVibe(chip)} style={{
            background: vibe === chip ? '#C05A2A22' : 'transparent',
            border: `1px solid ${vibe === chip ? '#C05A2A' : '#2A2825'}`,
            borderRadius: 20, padding: '4px 12px', fontSize: '0.7rem',
            color: vibe === chip ? '#C05A2A' : '#9A9288', cursor: 'pointer', fontFamily: 'DM Sans'
          }}>{chip}</button>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button style={{ flex: 1, background: '#C05A2A', border: 'none', borderRadius: 10, padding: '12px', color: '#F4F0E8', fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Flame size={16} /> Find a Move
        </button>
        <button onClick={() => setCreating(true)} style={{ flex: 1, background: 'transparent', border: '1px solid #C05A2A', borderRadius: 10, padding: '12px', color: '#C05A2A', fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Plus size={16} /> Create a Move
        </button>
      </div>

      {/* Tabs */}
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

      {/* Moves list */}
      {moves.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9A9288', padding: '2rem', fontSize: '0.85rem' }}>Loading moves...</div>
      ) : (
        moves.map(m => <MoveCard key={m.id} move={m} />)
      )}

      {/* Create Move Modal */}
      {creating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#1A1814', borderRadius: '16px 16px 0 0', padding: '1.5rem', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.4rem', color: '#F4F0E8', marginBottom: '1rem' }}>CREATE A MOVE</div>
            {['Move title', 'Location or venue', 'Time'].map(placeholder => (
              <input key={placeholder} placeholder={placeholder} style={{ width: '100%', background: '#0E0D0B', border: '1px solid #2A2825', borderRadius: 8, padding: '10px 12px', color: '#F4F0E8', fontFamily: 'DM Sans', fontSize: '0.875rem', marginBottom: '0.75rem', outline: 'none' }} />
            ))}
            <select style={{ width: '100%', background: '#0E0D0B', border: '1px solid #2A2825', borderRadius: 8, padding: '10px 12px', color: '#F4F0E8', fontFamily: 'DM Sans', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              <option>Visibility: Public</option>
              <option>Friends Only</option>
              <option>Invite Only</option>
            </select>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setCreating(false)} style={{ flex: 1, background: 'transparent', border: '1px solid #2A2825', borderRadius: 8, padding: 12, color: '#9A9288', cursor: 'pointer', fontFamily: 'DM Sans' }}>Cancel</button>
              <button onClick={() => setCreating(false)} style={{ flex: 1, background: '#C05A2A', border: 'none', borderRadius: 8, padding: 12, color: '#F4F0E8', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans' }}>Drop the Move</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
