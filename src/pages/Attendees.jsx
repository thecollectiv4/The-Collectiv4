import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { Users, Music, Palette, Camera, Sparkles, Lock } from 'lucide-react'

// Seed attendees for demo until real users come in
const SEED_ATTENDEES = [
  { display_name: 'Marcus Cole', bio: 'Producer & sound engineer', tags: ['Producer', 'Music'], avatar_letter: 'M' },
  { display_name: 'Jasmine Okafor', bio: 'Visual artist & muralist', tags: ['Artist', 'Muralist'], avatar_letter: 'J' },
  { display_name: 'Devon Mitchell', bio: 'House DJ, vinyl collector', tags: ['DJ', 'Vinyl'], avatar_letter: 'D' },
  { display_name: 'Sofía Reyes', bio: 'Fashion designer', tags: ['Fashion', 'Design'], avatar_letter: 'S' },
  { display_name: 'André Williams', bio: 'Photographer & filmmaker', tags: ['Photo', 'Film'], avatar_letter: 'A' },
  { display_name: 'Lila Chen', bio: 'Gallery curator', tags: ['Curator', 'Art'], avatar_letter: 'L' },
  { display_name: 'Carlos Mendoza', bio: 'Graphic design & branding', tags: ['Design', 'Brand'], avatar_letter: 'C' },
  { display_name: 'Amara Diallo', bio: 'Poet & creative director', tags: ['Writer', 'Creative'], avatar_letter: 'A' },
]

export default function Attendees() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [attendees, setAttendees] = useState([])

  useEffect(() => {
    // For now use seed data, later replace with real ticket holders
    setAttendees(SEED_ATTENDEES)
  }, [])

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
        <Lock size={32} style={{ color: '#5A5248', marginBottom: '16px' }} />
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: '#F4F0E8', letterSpacing: '0.04em', marginBottom: '8px' }}>
          Get your ticket to see who's going
        </div>
        <div style={{ fontSize: '13px', color: '#5A5248', marginBottom: '24px' }}>
          Buy a ticket to join the community and connect with other attendees.
        </div>
        <button onClick={() => navigate('/auth')} style={{
          background: '#C05A2A', border: 'none', borderRadius: '12px', padding: '14px 32px',
          color: '#F4F0E8', fontFamily: 'Bebas Neue', fontSize: '16px', letterSpacing: '0.06em', cursor: 'pointer'
        }}>
          JOIN THE COLLECTIVE
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0D0B' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.2em', color: '#5A5248', textTransform: 'uppercase', fontWeight: 600 }}>
          Ran By Artists · May 30
        </div>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: '#F4F0E8', letterSpacing: '0.04em', marginTop: '4px' }}>
          WHO'S <span style={{ color: '#C05A2A' }}>GOING</span>
        </div>
        <div style={{ fontSize: '12px', color: '#5A5248', marginTop: '4px' }}>
          {attendees.length} confirmed · room for more
        </div>
      </div>

      {/* Attendee list */}
      <div style={{ padding: '0 24px 100px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {attendees.map((person, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 16px', borderRadius: '12px',
              background: i % 2 === 0 ? '#1A1814' : 'transparent',
              transition: 'background 0.15s',
            }}>
              {/* Avatar */}
              <div style={{
                width: '42px', height: '42px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #2A2420 0%, #1A1210 100%)',
                border: '1px solid #2A2825',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Bebas Neue', fontSize: '16px', color: '#C05A2A',
                flexShrink: 0,
              }}>
                {person.avatar_letter}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '14px', fontWeight: 500, color: '#F4F0E8',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {person.display_name}
                </div>
                <div style={{ fontSize: '11px', color: '#5A5248', marginTop: '2px' }}>
                  {person.bio}
                </div>
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                {person.tags.slice(0, 1).map((tag, j) => (
                  <span key={j} style={{
                    fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: '#C05A2A', background: 'rgba(192,90,42,0.1)',
                    padding: '3px 8px', borderRadius: '20px', fontWeight: 600
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* More coming */}
        <div style={{
          textAlign: 'center', padding: '24px', marginTop: '16px',
          border: '1px dashed #2A2825', borderRadius: '12px',
        }}>
          <Sparkles size={18} style={{ color: '#5A5248', marginBottom: '8px' }} />
          <div style={{ fontSize: '12px', color: '#5A5248' }}>
            More people joining every day
          </div>
        </div>
      </div>
    </div>
  )
}
