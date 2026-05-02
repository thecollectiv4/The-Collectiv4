import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Clock, Calendar, Users, Music } from 'lucide-react'

const EDITIONS = [
  {
    id: '001',
    title: 'EDITION 001',
    venue: 'Sanman Studios',
    location: 'The Docks, Houston',
    date: 'April 4, 2026',
    time: '10PM — 2AM',
    attendees: '~220',
    lineup: ['Madou', 'Pato', 'Mellizos', 'CLTV4 Experience'],
    sponsors: ['Stained Vase', 'Arlo Espresso Club', 'RedBull', 'Bazaar'],
    vibe: 'The one that started it all. Raw energy, packed room, art on every wall. Houston showed up.',
    status: 'completed',
  }
]

export default function PastEditions() {
  const navigate = useNavigate()

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh'}}>
      <div style={{padding:'20px 28px',display:'flex',alignItems:'center',gap:'12px'}}>
        <button onClick={()=>navigate('/')} style={{background:'none',border:'none',color:'var(--cream-mid)',cursor:'pointer',display:'flex',alignItems:'center'}}>
          <ArrowLeft size={18}/>
        </button>
        <div>
          <div style={{fontFamily:'Bebas Neue',fontSize:'24px',color:'var(--cream)',letterSpacing:'.02em'}}>PAST EDITIONS</div>
          <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.1em'}}>YOUR EVENT HISTORY</div>
        </div>
      </div>

      <div style={{padding:'0 28px 100px'}}>
        {EDITIONS.map(ed => (
          <div key={ed.id} style={{
            border:'1px solid var(--border-hi)',
            borderRadius:'16px',
            overflow:'hidden',
            background:'var(--bg-card)',
            marginBottom:'16px',
          }}>
            {/* Ticket header */}
            <div style={{
              padding:'24px 24px 20px',
              background:'linear-gradient(135deg,#1A1208,#221A0C)',
              borderBottom:'1px dashed var(--border-hi)',
              position:'relative',
            }}>
              <div style={{position:'absolute',top:'16px',right:'16px'}}>
                <span style={{fontFamily:'DM Mono',fontSize:'8px',letterSpacing:'.15em',color:'var(--cream)',background:'rgba(255,255,255,.1)',padding:'4px 10px',borderRadius:'100px',border:'1px solid rgba(255,255,255,.15)'}}>ATTENDED</span>
              </div>
              <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.2em',marginBottom:'8px'}}>RAN BY ARTISTS</div>
              <div style={{display:'flex',alignItems:'baseline',gap:'10px'}}>
                <span style={{fontFamily:'Bebas Neue',fontSize:'52px',lineHeight:.85,color:'transparent',WebkitTextStroke:'1.5px var(--cream)'}}>001</span>
                <div>
                  <div style={{fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--cream)',letterSpacing:'.02em'}}>{ed.venue}</div>
                  <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',marginTop:'2px'}}>{ed.location}</div>
                </div>
              </div>
            </div>

            {/* Ticket body */}
            <div style={{padding:'20px 24px'}}>
              <div style={{display:'flex',flexWrap:'wrap',gap:'16px',marginBottom:'20px'}}>
                {[[Calendar,ed.date],[Clock,ed.time],[Users,ed.attendees+' people'],[MapPin,ed.location]].map(([Icon,text],i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                    <Icon size={12} strokeWidth={1.4} style={{color:'var(--cream-mid)'}} />
                    <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',letterSpacing:'.03em'}}>{text}</span>
                  </div>
                ))}
              </div>

              <p style={{fontSize:'13px',color:'var(--cream-mid)',lineHeight:1.6,marginBottom:'20px',fontStyle:'italic'}}>"{ed.vibe}"</p>

              <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.15em',color:'var(--cream-low)',marginBottom:'10px'}}>LINEUP</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'20px'}}>
                {ed.lineup.map((dj,i)=>(
                  <span key={i} style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream)',background:'var(--bg-raised)',border:'1px solid var(--border-hi)',padding:'4px 12px',borderRadius:'100px'}}>{dj}</span>
                ))}
              </div>

              <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.15em',color:'var(--cream-low)',marginBottom:'10px'}}>POWERED BY</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                {ed.sponsors.map((s,i)=>(
                  <span key={i} style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',background:'rgba(255,255,255,.04)',border:'1px solid var(--border)',padding:'4px 12px',borderRadius:'100px'}}>{s}</span>
                ))}
              </div>
            </div>

            {/* Ticket footer */}
            <div style={{padding:'16px 24px',borderTop:'1px dashed var(--border-hi)',background:'rgba(255,255,255,.02)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.08em'}}>THE COLLECTIV4 · HOUSTON, TX</div>
              <Music size={14} style={{color:'var(--cream-low)'}} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
