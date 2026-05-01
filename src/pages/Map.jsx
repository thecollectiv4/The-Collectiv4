import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { db } from '@/api/supabase'

const eventIcon = L.divIcon({ className: '', html: '<div style="background:#C05A2A;width:12px;height:12px;border-radius:50%;border:2px solid #F4F0E8;box-shadow:0 0 8px rgba(192,90,42,0.6)"></div>', iconSize: [12, 12] })
const moveIcon  = L.divIcon({ className: '', html: '<div style="background:#4A3A8A;width:12px;height:12px;border-radius:50%;border:2px solid #F4F0E8;box-shadow:0 0 8px rgba(74,58,138,0.6)"></div>', iconSize: [12, 12] })

export default function Map() {
  const [events, setEvents] = useState([])
  const [moves,  setMoves]  = useState([])
  const [layer,  setLayer]  = useState('all')

  useEffect(() => {
    db.events().select('*').then(({ data }) => { if (data) setEvents(data.filter(e => e.latitude)) })
    db.moves().select('*').then(({ data }) => { if (data) setMoves(data.filter(m => m.latitude)) })
  }, [])

  const layers = [
    { key: 'all',    label: 'All'     },
    { key: 'events', label: 'Events'  },
    { key: 'moves',  label: 'Moves'   },
  ]

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem 1rem 0.5rem', background: '#0E0D0B' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.4rem', letterSpacing: '0.06em', color: '#F4F0E8', marginBottom: '0.75rem' }}>
          HTX <span style={{ color: '#C05A2A' }}>MAP</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {layers.map(l => (
            <button key={l.key} onClick={() => setLayer(l.key)} style={{
              background: layer === l.key ? '#C05A2A' : 'transparent',
              border: `1px solid ${layer === l.key ? '#C05A2A' : '#2A2825'}`,
              borderRadius: 20, padding: '4px 14px', fontSize: '0.75rem',
              color: layer === l.key ? '#F4F0E8' : '#9A9288', cursor: 'pointer', fontFamily: 'DM Sans'
            }}>{l.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.65rem', color: '#9A9288', marginBottom: '0.5rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C05A2A', display: 'inline-block' }} /> Events</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4A3A8A', display: 'inline-block' }} /> Moves</span>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <MapContainer center={[29.7604, -95.3698]} zoom={12} style={{ height: '100%', width: '100%' }}
          attributionControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

          {(layer === 'all' || layer === 'events') && events.map(ev => (
            <Marker key={ev.id} position={[ev.latitude, ev.longitude]} icon={eventIcon}>
              <Popup>
                <div style={{ fontFamily: 'DM Sans', minWidth: 160 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>{ev.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 2 }}>{ev.venue_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 6 }}>{ev.date} · {ev.time}</div>
                  {!ev.is_free && <div style={{ fontWeight: 600, color: '#C05A2A', fontSize: '0.8rem' }}>${ev.ticket_price}</div>}
                  {ev.is_free && <div style={{ fontWeight: 600, color: '#2E6B3A', fontSize: '0.8rem' }}>Free</div>}
                </div>
              </Popup>
            </Marker>
          ))}

          {(layer === 'all' || layer === 'moves') && moves.map(mv => (
            <Marker key={mv.id} position={[mv.latitude, mv.longitude]} icon={moveIcon}>
              <Popup>
                <div style={{ fontFamily: 'DM Sans', minWidth: 160 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>{mv.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>{mv.time} · {mv.attendees?.length || 0} going</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
