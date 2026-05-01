import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '@/api/supabase'
import { ArrowLeft, MapPin, Clock, Users, Ticket } from 'lucide-react'

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [going, setGoing] = useState(false)

  useEffect(() => {
    db.events().select('*').eq('id', id).single().then(({ data }) => { if (data) setEvent(data) })
  }, [id])

  if (!event) return <div style={{ padding: '2rem', textAlign: 'center', color: '#9A9288' }}>Loading...</div>

  return (
    <div>
      {/* Cover */}
      <div style={{ height: 200, background: 'linear-gradient(135deg, #1A1208, #2A1A0A)', position: 'relative', display: 'flex', alignItems: 'flex-end', padding: '1rem', borderBottom: '3px solid #C05A2A' }}>
        <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.5)', border: '1px solid #2A2825', borderRadius: 8, padding: '8px', color: '#F4F0E8', cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <span style={{ background: '#C05A2A', color: '#F4F0E8', fontSize: '0.65rem', padding: '3px 10px', borderRadius: 20, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {event.vibe_type?.replace('_', ' ')}
          </span>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.8rem', color: '#F4F0E8', letterSpacing: '0.04em', marginTop: 6 }}>{event.title}</div>
        </div>
      </div>

      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
          {[
            { icon: MapPin, text: `${event.venue_name} · ${event.address}` },
            { icon: Clock,  text: `${event.date} · ${event.time}`           },
            { icon: Users,  text: `${event.attendees?.length || 0} going`   },
            { icon: Ticket, text: event.is_free ? 'Free entry' : `$${event.ticket_price} per ticket` },
          ].map(({ icon: Icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: '#E2DDD4' }}>
              <Icon size={15} color="#C05A2A" /> {text}
            </div>
          ))}
        </div>

        {event.description && (
          <p style={{ fontSize: '0.85rem', color: '#9A9288', lineHeight: 1.6, marginBottom: '1.25rem' }}>{event.description}</p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setGoing(!going)} style={{ flex: 2, background: going ? '#C05A2A' : 'transparent', border: '1px solid #C05A2A', borderRadius: 10, padding: '13px', color: going ? '#F4F0E8' : '#C05A2A', fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'DM Sans' }}>
            {going ? "I'm Going ✓" : 'Get Tickets'}
          </button>
          <button style={{ flex: 1, background: 'transparent', border: '1px solid #2A2825', borderRadius: 10, padding: '13px', color: '#9A9288', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'DM Sans' }}>
            Share
          </button>
        </div>
      </div>
    </div>
  )
}
