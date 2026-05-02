import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Clock, Calendar, Users, Music, Award } from 'lucide-react'

const EDITIONS = [
  {
    id: '001',
    venue: 'Sanman Studios',
    location: 'Houston, TX',
    date: 'April 4, 2026',
    time: '10PM — 2AM',
    attendees: '~220',
    lineup: ['Madou', 'Pato', 'Mellizos', 'CLTV4 Experience'],
    sponsors: ['Stained Vase', 'Arlo Espresso Club', 'RedBull', 'Bazaar'],
    vibe: 'The one that started it all. Raw energy, packed room, art on every wall. Houston showed up.',
  }
]

export default function PastEditions() {
  const navigate = useNavigate()

  return (
    <div style={{background:'linear-gradient(180deg,#161210 0%,#12100C 20%,#0D0A06 50%,#0D0A04 100%)',minHeight:'100vh'}}>
      {/* Header matching Event page */}
      <div style={{position:'sticky',top:0,zIndex:50,background:'rgba(13,10,4,.92)',backdropFilter:'blur(16px)',borderBottom:'1px solid var(--border-hi)',padding:'12px 28px',display:'flex',alignItems:'center',gap:'12px'}}>
        <button onClick={()=>navigate('/')} style={{background:'none',border:'none',color:'var(--cream)',cursor:'pointer',display:'flex',alignItems:'center'}}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{fontFamily:'Bebas Neue',fontSize:'16px',color:'var(--cream)',letterSpacing:'.06em'}}>PAST EDITIONS</div>
      </div>

      <div style={{padding:'24px 28px 100px'}}>
        {EDITIONS.map(ed => (
          <div key={ed.id} style={{
            borderRadius:'20px',
            overflow:'hidden',
            background:'linear-gradient(160deg,#1C1810,#141008,#0D0A04)',
            border:'1px solid rgba(255,255,255,.1)',
            boxShadow:'0 8px 40px rgba(0,0,0,.5)',
          }}>
            {/* Ticket hero */}
            <div style={{
              padding:'32px 28px 28px',
              position:'relative',
              overflow:'hidden',
            }}>
              {/* Subtle glow */}
              <div style={{position:'absolute',top:'-40px',right:'-40px',width:'200px',height:'200px',borderRadius:'50%',background:'radial-gradient(circle,rgba(255,255,255,.06) 0%,transparent 70%)',filter:'blur(40px)'}} />

              {/* ATTENDED badge - shiny */}
              <div style={{
                position:'absolute',top:'24px',right:'24px',
                display:'flex',alignItems:'center',gap:'6px',
                background:'linear-gradient(135deg,rgba(255,215,0,.2),rgba(255,255,255,.15),rgba(255,215,0,.2))',
                border:'1px solid rgba(255,215,0,.4)',
                borderRadius:'100px',padding:'6px 14px',
                boxShadow:'0 0 16px rgba(255,215,0,.15),inset 0 1px 0 rgba(255,255,255,.2)',
                animation:'countPulse 3s infinite',
              }}>
                <Award size={12} strokeWidth={2} style={{color:'#FFD700'}} />
                <span style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.12em',color:'#FFD700',fontWeight:700}}>ATTENDED</span>
              </div>

              <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.2em',marginBottom:'16px'}}>RAN BY ARTISTS</div>

              {/* Logo style - RAN outlined + ARTISTS solid + 001 */}
              <div style={{position:'relative',zIndex:2}}>
                <div style={{display:'flex',alignItems:'baseline',gap:'10px'}}>
                  <span style={{fontFamily:'Bebas Neue',fontSize:'64px',lineHeight:.85,letterSpacing:'2px',color:'transparent',WebkitTextStroke:'1.5px var(--cream)'}}>RAN</span>
                  <span style={{fontFamily:'Bebas Neue',fontSize:'26px',lineHeight:1,letterSpacing:'2px',color:'var(--cream)'}}>BY</span>
                </div>
                <div style={{display:'flex',alignItems:'baseline',gap:'14px',marginTop:'2px'}}>
                  <span style={{fontFamily:'Bebas Neue',fontSize:'64px',lineHeight:.85,letterSpacing:'2px',color:'var(--cream)'}}>ARTISTS</span>
                  <span style={{fontFamily:'Bebas Neue',fontSize:'48px',lineHeight:.85,color:'transparent',WebkitTextStroke:'1px rgba(255,255,255,.25)'}}>001</span>
                </div>
              </div>

              <div style={{marginTop:'20px',fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--cream)',letterSpacing:'.02em'}}>{ed.venue}</div>
              <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',marginTop:'4px'}}>{ed.location}</div>
            </div>

            {/* Dashed divider */}
            <div style={{margin:'0 28px',borderTop:'1px dashed rgba(255,255,255,.12)'}} />

            {/* Ticket details */}
            <div style={{padding:'24px 28px'}}>
              <div style={{display:'flex',flexWrap:'wrap',gap:'18px',marginBottom:'24px'}}>
                {[[Calendar,ed.date],[Clock,ed.time],[Users,ed.attendees],[MapPin,ed.venue]].map(([Icon,text],i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                    <Icon size={12} strokeWidth={1.4} style={{color:'var(--cream)'}} />
                    <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',letterSpacing:'.03em'}}>{text}</span>
                  </div>
                ))}
              </div>

              <p style={{fontSize:'14px',color:'var(--cream-mid)',lineHeight:1.65,marginBottom:'24px',fontStyle:'italic',borderLeft:'2px solid rgba(255,255,255,.15)',paddingLeft:'16px'}}>"{ed.vibe}"</p>

              <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.15em',color:'var(--cream)',marginBottom:'10px'}}>LINEUP</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'24px'}}>
                {ed.lineup.map((dj,i)=>(
                  <span key={i} style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream)',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.12)',padding:'5px 14px',borderRadius:'100px'}}>{dj}</span>
                ))}
              </div>

              <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.15em',color:'var(--cream)',marginBottom:'10px'}}>POWERED BY</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                {ed.sponsors.map((s,i)=>(
                  <span key={i} style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',padding:'5px 14px',borderRadius:'100px'}}>{s}</span>
                ))}
              </div>
            </div>

            {/* Dashed divider */}
            <div style={{margin:'0 28px',borderTop:'1px dashed rgba(255,255,255,.12)'}} />

            {/* Footer */}
            <div style={{padding:'16px 28px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.08em'}}>THE COLLECTIV4 · HOUSTON, TX</div>
              <Music size={14} style={{color:'var(--cream-low)'}} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
