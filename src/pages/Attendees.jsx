import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { Lock, Sparkles } from 'lucide-react'

const SEED_ATTENDEES = [
  { name: 'Marcus Cole', bio: 'Producer & sound engineer', tag: 'MUSIC' },
  { name: 'Jasmine Okafor', bio: 'Visual artist & muralist', tag: 'ART' },
  { name: 'Devon Mitchell', bio: 'House DJ, vinyl collector', tag: 'DJ' },
  { name: 'Sofía Reyes', bio: 'Fashion designer', tag: 'FASHION' },
  { name: 'André Williams', bio: 'Photographer & filmmaker', tag: 'PHOTO' },
  { name: 'Lila Chen', bio: 'Gallery curator', tag: 'CURATOR' },
  { name: 'Carlos Mendoza', bio: 'Graphic design & branding', tag: 'DESIGN' },
  { name: 'Amara Diallo', bio: 'Poet & creative director', tag: 'CREATIVE' },
  { name: 'Pato Durán', bio: 'DJ & Founder, The Collectiv4', tag: 'FOUNDER' },
  { name: 'Diego Villaseñor', bio: 'Creative Director, Visurelic', tag: 'CREATIVE' },
]

export default function Attendees() {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center' }}>
        <Lock size={24} strokeWidth={1.2} style={{ color: '#333', marginBottom: '20px' }} />
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: '#FFF', letterSpacing: '0.02em', marginBottom: '8px' }}>
          SEE WHO'S GOING
        </div>
        <div style={{ fontSize: '13px', color: '#555', marginBottom: '28px', lineHeight: 1.6 }}>
          Create an account to connect with other attendees.
        </div>
        <button onClick={() => navigate('/auth')} style={{
          background: '#FFF', border: 'none', borderRadius: '10px', padding: '14px 36px',
          color: '#000', fontFamily: 'DM Sans', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}>
          Join
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      <div style={{ padding: '20px 28px 16px' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.3em', color: '#444', textTransform: 'uppercase' }}>
          Ran By Artists · May 30
        </div>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '32px', color: '#FFF', letterSpacing: '0.02em', marginTop: '6px' }}>
          WHO'S GOING
        </div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#444', marginTop: '6px', letterSpacing: '0.06em' }}>
          {SEED_ATTENDEES.length} CONFIRMED
        </div>
      </div>

      <div style={{ padding: '0 28px 100px' }}>
        {SEED_ATTENDEES.map((person, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '16px 0',
            borderBottom: i < SEED_ATTENDEES.length - 1 ? '1px solid #1A1A1A' : 'none',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: '#111', border: '1px solid #1A1A1A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Bebas Neue', fontSize: '16px', color: '#555',
              flexShrink: 0,
            }}>
              {person.name[0]}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#FFF' }}>
                {person.name}
              </div>
              <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>
                {person.bio}
              </div>
            </div>

            <span style={{
              fontFamily: 'DM Mono, monospace', fontSize: '8px',
              letterSpacing: '0.1em', color: '#555',
              border: '1px solid #222', padding: '3px 10px', borderRadius: '100px',
            }}>
              {person.tag}
            </span>
          </div>
        ))}

        <div style={{
          textAlign: 'center', padding: '28px', marginTop: '16px',
          border: '1px solid #1A1A1A', borderRadius: '12px',
        }}>
          <Sparkles size={16} strokeWidth={1.2} style={{ color: '#333', marginBottom: '8px' }} />
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#444', letterSpacing: '0.06em' }}>
            More joining every day
          </div>
        </div>
      </div>
    </div>
  )
}
