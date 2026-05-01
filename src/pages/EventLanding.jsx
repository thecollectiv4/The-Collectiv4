import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { MapPin, Clock, Calendar, Ticket, Users, Check, ArrowRight, Music, Palette, Shirt, Printer } from 'lucide-react'

const LINEUP = [
  { name: 'MADOU', role: 'DJ SET', tag: 'House · Deep' },
  { name: 'PATO', role: 'DJ SET', tag: 'House · Techno', handle: '@patoduranc' },
  { name: 'MELLIZOS', role: 'DJ SET', tag: 'House' },
  { name: 'CLTV4 EXPERIENCE', role: 'LIVE', tag: 'Art · Fashion · Sound' },
]

const TIERS = [
  { name: 'EARLY BIRD', price: 15, status: 'available', note: 'Limited' },
  { name: 'GENERAL', price: 25, status: 'soon', note: 'Coming soon' },
  { name: 'DOOR', price: 40, status: 'soon', note: 'Night of' },
]

export default function EventLanding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [attendeeCount, setAttendeeCount] = useState(0)
  const [hasTicket, setHasTicket] = useState(false)

  useEffect(() => {
    supabase.from('tickets').select('id', { count: 'exact', head: true })
      .then(({ count }) => setAttendeeCount(count || 14))
      .catch(() => setAttendeeCount(14))
    if (user) {
      supabase.from('tickets').select('id').eq('user_id', user.id).single()
        .then(({ data }) => setHasTicket(!!data))
        .catch(() => setHasTicket(false))
    }
  }, [user])

  const handleGetTicket = () => {
    if (!user) navigate('/auth')
    else alert('Stripe checkout coming soon — tickets go live May 15')
  }

  const daysUntil = Math.max(0, Math.ceil((new Date('2026-05-30') - new Date()) / 86400000))

  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>

      {/* ═══════ HERO ═══════ */}
      <div style={{
        position: 'relative', minHeight: '460px',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '0 28px 36px', overflow: 'hidden',
      }}>
        {/* Background gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, #0A0A0A 0%, #000 30%, #0A0604 60%, #000 100%)',
        }} />

        {/* Subtle glow */}
        <div style={{
          position: 'absolute', bottom: '0', left: '50%', transform: 'translateX(-50%)',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(192,90,42,0.12) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }} />

        {/* Noise texture */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Countdown pill */}
          <div className="fade-up" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            border: '1px solid #333', borderRadius: '100px', padding: '6px 16px',
            marginBottom: '32px',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C05A2A', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#888', letterSpacing: '0.08em' }}>
              {daysUntil} DAYS OUT
            </span>
          </div>

          {/* Presents */}
          <div className="fade-up-1" style={{
            fontFamily: 'DM Sans', fontSize: '11px', letterSpacing: '0.3em',
            color: '#555', textTransform: 'uppercase', fontWeight: 500, marginBottom: '16px',
          }}>
            The Collectiv4 presents
          </div>

          {/* Main title */}
          <h1 className="fade-up-2" style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '72px', lineHeight: 0.88, letterSpacing: '-1px',
            color: '#FFF', margin: 0, fontWeight: 400,
          }}>
            RAN BY<br/>ARTISTS
          </h1>

          {/* Tagline */}
          <p className="fade-up-3" style={{
            fontSize: '13px', color: '#666', lineHeight: 1.6,
            marginTop: '20px', maxWidth: '300px',
          }}>
            House music. Live art. Fashion. Culture.<br/>
            One room. One night. No bullshit.
          </p>

          {/* Meta */}
          <div className="fade-up-4" style={{ display: 'flex', gap: '24px', marginTop: '24px' }}>
            {[
              { icon: Calendar, text: 'MAY 30' },
              { icon: Clock, text: '10PM — 2AM' },
              { icon: MapPin, text: 'HOUSTON' },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon size={12} strokeWidth={1.4} style={{ color: '#555' }} />
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#888', letterSpacing: '0.06em' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════ CTA ═══════ */}
      <div style={{ padding: '0 28px 32px' }}>
        {hasTicket ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            border: '1px solid rgba(46,107,26,0.4)', borderRadius: '12px', padding: '18px',
          }}>
            <Check size={18} style={{ color: '#4CAF50' }} />
            <span style={{ color: '#4CAF50', fontWeight: 500, fontSize: '14px' }}>You're in. See you May 30.</span>
          </div>
        ) : (
          <button onClick={handleGetTicket} style={{
            width: '100%', background: '#FFF', border: 'none', borderRadius: '12px',
            padding: '18px 24px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            transition: 'opacity 0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Ticket size={18} style={{ color: '#000' }} />
              <span style={{ fontFamily: 'Bebas Neue', fontSize: '18px', color: '#000', letterSpacing: '0.06em' }}>
                GET YOUR TICKET
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#666' }}>from $15</span>
              <ArrowRight size={16} style={{ color: '#000' }} />
            </div>
          </button>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          marginTop: '14px', fontSize: '11px', color: '#444',
        }}>
          <Users size={12} />
          <span><strong style={{ color: '#888' }}>{attendeeCount}</strong> confirmed</span>
          {user && (
            <span onClick={() => navigate('/attendees')} style={{ color: '#888', cursor: 'pointer', marginLeft: '4px' }}>
              · View all →
            </span>
          )}
        </div>
      </div>

      {/* ═══════ DIVIDER ═══════ */}
      <div style={{ height: '1px', background: '#1A1A1A', margin: '0 28px' }} />

      {/* ═══════ LINEUP ═══════ */}
      <div style={{ padding: '36px 28px' }}>
        <div style={{
          fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.3em',
          color: '#444', textTransform: 'uppercase', marginBottom: '24px',
        }}>
          LINEUP
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {LINEUP.map((artist, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 0',
              borderBottom: i < LINEUP.length - 1 ? '1px solid #1A1A1A' : 'none',
            }}>
              <div>
                <div style={{
                  fontFamily: 'Bebas Neue', fontSize: '28px', color: '#FFF',
                  letterSpacing: '0.02em', lineHeight: 1,
                }}>
                  {artist.name}
                </div>
                <div style={{
                  fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#555',
                  marginTop: '4px', letterSpacing: '0.04em',
                }}>
                  {artist.tag}
                </div>
              </div>

              <div style={{
                fontFamily: 'DM Mono, monospace', fontSize: '9px',
                letterSpacing: '0.1em', color: '#666',
                border: '1px solid #333', padding: '4px 12px', borderRadius: '100px',
              }}>
                {artist.role}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════ DIVIDER ═══════ */}
      <div style={{ height: '1px', background: '#1A1A1A', margin: '0 28px' }} />

      {/* ═══════ TICKETS ═══════ */}
      <div style={{ padding: '36px 28px' }}>
        <div style={{
          fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.3em',
          color: '#444', textTransform: 'uppercase', marginBottom: '24px',
        }}>
          TICKETS
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {TIERS.map((tier, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 20px', borderRadius: '12px',
              border: `1px solid ${tier.status === 'available' ? '#333' : '#1A1A1A'}`,
              background: tier.status === 'available' ? '#0A0A0A' : 'transparent',
            }}>
              <div>
                <div style={{
                  fontFamily: 'Bebas Neue', fontSize: '18px', color: '#FFF',
                  letterSpacing: '0.04em',
                }}>
                  {tier.name}
                </div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: '#555', marginTop: '2px', letterSpacing: '0.06em' }}>
                  {tier.note}
                </div>
              </div>

              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  fontFamily: 'Bebas Neue', fontSize: '28px',
                  color: tier.status === 'available' ? '#FFF' : '#333',
                }}>
                  ${tier.price}
                </span>
                {tier.status === 'available' && (
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#C05A2A',
                  }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════ DIVIDER ═══════ */}
      <div style={{ height: '1px', background: '#1A1A1A', margin: '0 28px' }} />

      {/* ═══════ THE EXPERIENCE ═══════ */}
      <div style={{ padding: '36px 28px' }}>
        <div style={{
          fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.3em',
          color: '#444', textTransform: 'uppercase', marginBottom: '24px',
        }}>
          THE EXPERIENCE
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#1A1A1A', borderRadius: '12px', overflow: 'hidden' }}>
          {[
            { icon: Music, label: 'HOUSE MUSIC', desc: 'Curated sets all night' },
            { icon: Palette, label: 'LIVE ART', desc: 'Painted in real time' },
            { icon: Shirt, label: 'FASHION', desc: 'Local brands & merch' },
            { icon: Printer, label: 'SCREEN PRINT', desc: 'Custom prints live' },
          ].map(({ icon: Icon, label, desc }, i) => (
            <div key={i} style={{
              background: '#0A0A0A', padding: '24px 18px',
              display: 'flex', flexDirection: 'column', gap: '10px',
            }}>
              <Icon size={18} strokeWidth={1.2} style={{ color: '#555' }} />
              <div>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: '14px', color: '#FFF', letterSpacing: '0.04em' }}>
                  {label}
                </div>
                <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════ DIVIDER ═══════ */}
      <div style={{ height: '1px', background: '#1A1A1A', margin: '0 28px' }} />

      {/* ═══════ PROOF / EDITION 1 ═══════ */}
      <div style={{ padding: '48px 28px', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '0.3em',
          color: '#444', textTransform: 'uppercase', marginBottom: '24px',
        }}>
          EDITION 01 · APRIL 4, 2026
        </div>

        <div style={{
          fontFamily: 'Bebas Neue', fontSize: '80px', color: '#FFF',
          lineHeight: 0.9, letterSpacing: '-2px',
        }}>
          223
        </div>
        <div style={{
          fontSize: '13px', color: '#555', marginTop: '8px', lineHeight: 1.5,
        }}>
          people in one room, feeling the same thing.
        </div>

        <div style={{
          marginTop: '24px', padding: '20px',
          border: '1px solid #1A1A1A', borderRadius: '12px',
        }}>
          <p style={{ fontSize: '14px', color: '#888', lineHeight: 1.7, fontStyle: 'italic' }}>
            We built something real. 220 people in a room all feeling the same thing. That is the foundation.
          </p>
          <div style={{ fontSize: '11px', color: '#444', marginTop: '12px' }}>
            — Sanman Studios, Houston
          </div>
        </div>
      </div>

      {/* ═══════ FOOTER ═══════ */}
      <div style={{
        padding: '36px 28px 120px',
        borderTop: '1px solid #1A1A1A',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: 'Bebas Neue', fontSize: '24px', color: '#FFF',
          letterSpacing: '0.02em',
        }}>
          THE COLLECTIV4
        </div>
        <div style={{
          fontFamily: 'DM Mono, monospace', fontSize: '10px',
          color: '#444', marginTop: '8px', letterSpacing: '0.1em',
        }}>
          ART · MUSIC · FASHION · EVENTS
        </div>
        <div style={{ fontSize: '12px', color: '#333', marginTop: '16px' }}>
          @thecollectiv4
        </div>
      </div>
    </div>
  )
}
