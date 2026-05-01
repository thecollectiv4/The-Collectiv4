import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { MapPin, Clock, Calendar, ChevronRight, Ticket, Users, Check } from 'lucide-react'

const LINEUP = [
  { name: 'MADOU', role: 'DJ', tag: 'House / Deep', img: null },
  { name: 'PATO', role: 'DJ', tag: 'House / Techno', handle: '@patoduranc', img: null },
  { name: 'MELLIZOS', role: 'DJ', tag: 'House', img: null },
  { name: 'CLTV4 EXPERIENCE', role: 'Live', tag: 'Art + Fashion + Sound', img: null },
]

const TIERS = [
  { name: 'Early Bird', price: 15, status: 'available', desc: 'Limited first wave' },
  { name: 'General', price: 25, status: 'soon', desc: 'Standard entry' },
  { name: 'Door', price: 40, status: 'soon', desc: 'Night of the event' },
]

export default function EventLanding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [attendeeCount, setAttendeeCount] = useState(0)
  const [hasTicket, setHasTicket] = useState(false)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    // Get attendee count
    supabase.from('tickets').select('id', { count: 'exact', head: true })
      .then(({ count }) => setAttendeeCount(count || 12))
      .catch(() => setAttendeeCount(12))

    // Check if current user has ticket
    if (user) {
      supabase.from('tickets').select('id').eq('user_id', user.id).single()
        .then(({ data }) => setHasTicket(!!data))
        .catch(() => setHasTicket(false))
    }
  }, [user])

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleGetTicket = () => {
    if (!user) {
      navigate('/auth')
    } else {
      // TODO: Stripe checkout
      alert('Stripe checkout coming soon — ticketing goes live May 15')
    }
  }

  const daysUntil = Math.max(0, Math.ceil((new Date('2026-05-30') - new Date()) / 86400000))

  return (
    <div style={{ minHeight: '100vh', background: '#0E0D0B' }}>

      {/* HERO */}
      <div style={{
        position: 'relative', height: '420px', overflow: 'hidden',
        background: 'linear-gradient(135deg, #1A0A04 0%, #0E0D0B 40%, #1A1210 70%, #2A1008 100%)',
      }}>
        {/* Grain overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.15,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }} />

        {/* Rust glow */}
        <div style={{
          position: 'absolute', bottom: '-80px', left: '50%', transform: `translateX(-50%) translateY(${scrollY * 0.2}px)`,
          width: '300px', height: '300px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(192,90,42,0.25) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2, padding: '48px 24px 24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          
          {/* Date badge */}
          <div style={{
            position: 'absolute', top: '20px', right: '20px',
            background: 'rgba(192,90,42,0.15)', border: '1px solid rgba(192,90,42,0.3)',
            borderRadius: '8px', padding: '6px 12px',
            fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#C05A2A',
            letterSpacing: '0.05em'
          }}>
            {daysUntil} DAYS
          </div>

          {/* Brand */}
          <div style={{ fontSize: '10px', letterSpacing: '0.25em', color: '#5A5248', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600 }}>
            The Collectiv4 presents
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'Bebas Neue, sans-serif', fontSize: '52px', lineHeight: 0.9,
            color: '#F4F0E8', letterSpacing: '0.02em', margin: 0
          }}>
            RAN BY<br/>
            <span style={{ color: '#C05A2A' }}>ARTISTS</span>
          </h1>

          <div style={{ fontSize: '13px', color: '#9A9288', marginTop: '14px', letterSpacing: '0.02em', lineHeight: 1.5 }}>
            House music. Live art. Fashion. Culture.<br/>
            One room. One night. No bullshit.
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
            {[
              { icon: Calendar, text: 'May 30, 2026' },
              { icon: Clock, text: '10PM — 2AM' },
              { icon: MapPin, text: 'Houston · TBA' },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#9A9288' }}>
                <Icon size={14} strokeWidth={1.5} style={{ color: '#C05A2A' }} />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA STICKY or INLINE */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #1A1814' }}>
        {hasTicket ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            background: 'rgba(46,107,26,0.15)', border: '1px solid rgba(46,107,26,0.3)',
            borderRadius: '14px', padding: '16px',
          }}>
            <Check size={20} style={{ color: '#4CAF50' }} />
            <span style={{ color: '#4CAF50', fontWeight: 600, fontSize: '14px' }}>You're in. See you May 30.</span>
          </div>
        ) : (
          <button onClick={handleGetTicket} style={{
            width: '100%', background: '#C05A2A', border: 'none', borderRadius: '14px',
            padding: '18px', color: '#F4F0E8', fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '20px', letterSpacing: '0.08em', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            transition: 'transform 0.15s, opacity 0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            <Ticket size={20} />
            GET YOUR TICKET
            <span style={{ fontSize: '14px', opacity: 0.8, fontFamily: 'DM Sans', fontWeight: 400 }}>from $15</span>
          </button>
        )}

        {/* Attendee count */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          marginTop: '12px', fontSize: '12px', color: '#5A5248'
        }}>
          <Users size={14} />
          <span><strong style={{ color: '#9A9288' }}>{attendeeCount}</strong> people going</span>
          {user && <span style={{ color: '#C05A2A', cursor: 'pointer', fontSize: '11px' }} onClick={() => navigate('/attendees')}>See who →</span>}
        </div>
      </div>

      {/* LINEUP */}
      <div style={{ padding: '28px 24px' }}>
        <div style={{
          fontSize: '10px', letterSpacing: '0.2em', color: '#5A5248',
          textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px'
        }}>
          Lineup
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {LINEUP.map((artist, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 16px', borderRadius: '12px',
              background: i % 2 === 0 ? '#1A1814' : 'transparent',
              transition: 'background 0.15s',
            }}>
              {/* Avatar placeholder */}
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: `linear-gradient(135deg, #2A2420 0%, #1A1210 100%)`,
                border: '1px solid #2A2825',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Bebas Neue', fontSize: '16px', color: '#C05A2A',
              }}>
                {artist.name[0]}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: 'Bebas Neue, sans-serif', fontSize: '18px',
                  color: '#F4F0E8', letterSpacing: '0.04em'
                }}>
                  {artist.name}
                </div>
                <div style={{ fontSize: '11px', color: '#5A5248', marginTop: '1px' }}>
                  {artist.role} · {artist.tag}
                </div>
              </div>

              <div style={{
                fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase',
                color: '#C05A2A', fontWeight: 600,
                background: 'rgba(192,90,42,0.1)', padding: '4px 10px', borderRadius: '20px',
              }}>
                {artist.role}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TICKET TIERS */}
      <div style={{ padding: '4px 24px 28px' }}>
        <div style={{
          fontSize: '10px', letterSpacing: '0.2em', color: '#5A5248',
          textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px'
        }}>
          Tickets
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {TIERS.map((tier, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 18px', borderRadius: '12px',
              background: '#1A1814', border: `1px solid ${tier.status === 'available' ? 'rgba(192,90,42,0.3)' : '#2A2825'}`,
            }}>
              <div>
                <div style={{
                  fontFamily: 'Bebas Neue', fontSize: '16px', color: '#F4F0E8',
                  letterSpacing: '0.04em'
                }}>
                  {tier.name}
                </div>
                <div style={{ fontSize: '11px', color: '#5A5248', marginTop: '2px' }}>
                  {tier.desc}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'Bebas Neue', fontSize: '24px',
                  color: tier.status === 'available' ? '#C05A2A' : '#5A5248',
                }}>
                  ${tier.price}
                </div>
                <div style={{
                  fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: tier.status === 'available' ? '#C05A2A' : '#5A5248',
                  fontWeight: 600,
                }}>
                  {tier.status === 'available' ? '● Available' : 'Coming soon'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ABOUT THE EXPERIENCE */}
      <div style={{ padding: '4px 24px 28px' }}>
        <div style={{
          fontSize: '10px', letterSpacing: '0.2em', color: '#5A5248',
          textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px'
        }}>
          The Experience
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { label: 'House Music', desc: 'Curated sets all night' },
            { label: 'Live Painting', desc: 'Art created in real time' },
            { label: 'Fashion Pop-Up', desc: 'Local brands + merch' },
            { label: 'Screen Printing', desc: 'Custom prints on the spot' },
          ].map((item, i) => (
            <div key={i} style={{
              background: '#1A1814', borderRadius: '12px', padding: '16px',
              border: '1px solid #2A2825',
            }}>
              <div style={{
                fontFamily: 'Bebas Neue', fontSize: '14px', color: '#F4F0E8',
                letterSpacing: '0.04em', marginBottom: '4px'
              }}>
                {item.label}
              </div>
              <div style={{ fontSize: '11px', color: '#5A5248', lineHeight: 1.4 }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* EDITION 1 PROOF */}
      <div style={{
        padding: '28px 24px', borderTop: '1px solid #1A1814',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '10px', letterSpacing: '0.2em', color: '#5A5248',
          textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px'
        }}>
          Edition 1 — April 4, 2026
        </div>
        <div style={{
          fontFamily: 'Bebas Neue', fontSize: '42px', color: '#C05A2A',
          lineHeight: 1
        }}>
          223
        </div>
        <div style={{ fontSize: '12px', color: '#5A5248', marginTop: '4px' }}>
          people in one room, feeling the same thing.
        </div>
        <div style={{
          fontSize: '13px', color: '#9A9288', marginTop: '16px',
          fontStyle: 'italic', lineHeight: 1.5
        }}>
          "We built something real. That is the foundation."
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        padding: '28px 24px 120px', borderTop: '1px solid #1A1814',
        textAlign: 'center'
      }}>
        <div style={{
          fontFamily: 'Bebas Neue', fontSize: '18px', color: '#F4F0E8',
          letterSpacing: '0.06em', marginBottom: '8px'
        }}>
          THE <span style={{ color: '#C05A2A' }}>COLLECTIV4</span>
        </div>
        <div style={{ fontSize: '11px', color: '#5A5248', lineHeight: 1.6 }}>
          Houston's creative infrastructure.<br/>
          @thecollectiv4
        </div>
      </div>
    </div>
  )
}
