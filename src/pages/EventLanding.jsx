import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { MapPin, Clock, Calendar, Ticket, Users, Check, ArrowRight, ChevronRight, Loader2 } from 'lucide-react'

const LINEUP = [
  { handle:'madou', name:'MADOU', role:'DJ SET', tag:'House · Deep', ig:'@natemadou' },
  { handle:'patoduranc', name:'PATO', role:'DJ SET', tag:'House · Techno', ig:'@patoduranc' },
]
const EXPERIENCES = [
  { slug:'live-art', label:'LIVE ART', short:'Paintings created in real time as the music plays.', icon:'◐' },
  { slug:'gallery', label:'GALLERY', short:'Original works by the painter on display. Art you can feel.', icon:'◧' },
  { slug:'fashion', label:'FASHION POP-UP', short:'Local Houston designers. Wearable culture.', icon:'△' },
  { slug:'screen-printing', label:'SCREEN PRINTING', short:'Custom prints made live. Leave with something that only exists tonight.', icon:'▣' },
]
const TIERS = [
  { id:'early-bird', name:'EARLY BIRD', price:15, status:'available', note:'Limited first wave' },
  { id:'general', name:'GENERAL', price:25, status:'soon', note:'Available May 15' },
  { id:'door', name:'DOOR', price:40, status:'soon', note:'Night of the event' },
]

export default function EventLanding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [attendeeCount, setAttendeeCount] = useState(0)
  const [hasTicket, setHasTicket] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [ticketStatus, setTicketStatus] = useState(null) // 'success' | 'cancelled'

  useEffect(() => {
    const status = searchParams.get('ticket')
    if (status === 'success') setTicketStatus('success')
    if (status === 'cancelled') setTicketStatus('cancelled')
  }, [searchParams])

  useEffect(() => {
    supabase.from('tickets').select('id',{count:'exact',head:true}).then(({count})=>setAttendeeCount(count||0)).catch(()=>setAttendeeCount(0))
    if(user) supabase.from('tickets').select('id').eq('user_id',user.id).single().then(({data})=>setHasTicket(!!data)).catch(()=>{})
  },[user])
  const days = Math.max(0,Math.ceil((new Date('2026-05-30')-new Date())/86400000))

  async function handleCheckout(tierId) {
    if (!user) { navigate('/auth'); return }
    setCheckingOut(true)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierId, email: user.email }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Something went wrong. Try again.')
        setCheckingOut(false)
      }
    } catch (err) {
      alert('Connection error. Try again.')
      setCheckingOut(false)
    }
  }

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh'}}>

      {/* HERO */}
      <div style={{position:'relative',minHeight:'500px',display:'flex',flexDirection:'column',justifyContent:'flex-end',padding:'0 28px 44px',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,background:'linear-gradient(160deg,#1C1106 0%,#0D0A04 35%,#14100A 70%,#0D0A04 100%)'}} />
        <div style={{position:'absolute',bottom:'-80px',left:'20%',width:'280px',height:'280px',borderRadius:'50%',background:'radial-gradient(circle,rgba(200,144,48,.1) 0%,transparent 70%)',filter:'blur(80px)'}} />
        <div style={{position:'absolute',top:'60px',right:'-20px',width:'200px',height:'200px',borderRadius:'50%',background:'radial-gradient(circle,rgba(200,90,24,.09) 0%,transparent 70%)',filter:'blur(60px)'}} />
        <div style={{position:'absolute',inset:0,opacity:.06,backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"}} />
        <div style={{position:'relative',zIndex:2}}>
          <div className="fade-up" style={{display:'flex',gap:'10px',marginBottom:'36px',flexWrap:'wrap'}}>
            <div style={{border:'1px solid rgba(200,144,48,.4)',borderRadius:'100px',padding:'5px 14px',fontFamily:'DM Mono',fontSize:'10px',color:'var(--gold)',letterSpacing:'.1em'}}>EDITION 002</div>
            <div style={{border:'1px solid var(--border)',borderRadius:'100px',padding:'5px 14px',display:'flex',alignItems:'center',gap:'6px'}}>
              <div style={{width:'5px',height:'5px',borderRadius:'50%',background:'var(--rust)',animation:'pulse 2s infinite'}} />
              <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',letterSpacing:'.06em'}}>{days} DAYS</span>
            </div>
          </div>
          <div className="fade-up-1" style={{fontSize:'10px',letterSpacing:'.3em',color:'var(--cream-low)',textTransform:'uppercase',fontWeight:600,marginBottom:'14px'}}>The Collectiv4 presents</div>
          <h1 className="fade-up-2" style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'78px',lineHeight:.88,letterSpacing:'-1px',color:'var(--cream)',margin:0}}>
            RAN BY<br/>ARTISTS
          </h1>
          <p className="fade-up-3" style={{fontSize:'14px',color:'var(--cream-mid)',lineHeight:1.65,marginTop:'22px',maxWidth:'320px'}}>
            A night where Houston's artists stop performing for the world and start creating for each other. Sound, paint, and fabric — alive in the same room.
          </p>
          <div className="fade-up-4" style={{display:'flex',flexWrap:'wrap',gap:'20px',marginTop:'26px'}}>
            {[[Calendar,'MAY 30, 2026'],[Clock,'10PM — 2AM'],[MapPin,'HOUSTON · TBA']].map(([Icon,text],i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                <Icon size={12} strokeWidth={1.4} style={{color:'var(--rust)'}} />
                <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',letterSpacing:'.05em'}}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{padding:'0 28px 32px'}}>
        {ticketStatus === 'success' && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',border:'1px solid rgba(74,122,42,.4)',borderRadius:'12px',padding:'18px',background:'rgba(74,122,42,.06)',marginBottom:'12px'}}>
            <Check size={16} style={{color:'#6ABF4A'}} />
            <span style={{color:'#6ABF4A',fontWeight:500,fontSize:'14px'}}>You're in. Check your email for your ticket. See you May 30.</span>
          </div>
        )}
        {ticketStatus === 'cancelled' && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',border:'1px solid rgba(200,90,24,.4)',borderRadius:'12px',padding:'18px',background:'rgba(200,90,24,.06)',marginBottom:'12px'}}>
            <span style={{color:'var(--rust)',fontWeight:500,fontSize:'14px'}}>Checkout cancelled. No charge was made.</span>
          </div>
        )}
        {hasTicket || ticketStatus === 'success' ? (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',border:'1px solid rgba(74,122,42,.4)',borderRadius:'12px',padding:'18px',background:'rgba(74,122,42,.06)'}}>
            <Check size={16} style={{color:'#6ABF4A'}} />
            <span style={{color:'#6ABF4A',fontWeight:500,fontSize:'14px'}}>You're in. See you May 30.</span>
          </div>
        ) : (
          <button onClick={()=>handleCheckout('early-bird')} disabled={checkingOut}
            style={{width:'100%',background:checkingOut?'var(--cream-low)':'var(--cream)',border:'none',borderRadius:'12px',padding:'18px 24px',cursor:checkingOut?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',transition:'opacity .15s'}}
            onMouseOver={e=>{if(!checkingOut)e.currentTarget.style.opacity='.9'}} onMouseOut={e=>e.currentTarget.style.opacity='1'}>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              {checkingOut ? <Loader2 size={18} style={{color:'var(--bg)',animation:'spin 1s linear infinite'}} /> : <Ticket size={18} style={{color:'var(--bg)'}} />}
              <span style={{fontFamily:'Bebas Neue',fontSize:'18px',color:'var(--bg)',letterSpacing:'.06em'}}>{checkingOut ? 'REDIRECTING TO CHECKOUT...' : 'GET YOUR TICKET'}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontSize:'12px',color:'#6A5040',fontWeight:500}}>from $15</span>
              <ArrowRight size={14} style={{color:'var(--bg)'}} />
            </div>
          </button>
        )}
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginTop:'12px',fontSize:'11px',color:'var(--cream-low)'}}>
          <Users size={12}/><strong style={{color:'var(--cream-mid)'}}>{attendeeCount}</strong><span>confirmed</span>
          {user&&<span onClick={()=>navigate('/attendees')} style={{color:'var(--rust)',cursor:'pointer',marginLeft:'4px'}}>· See who →</span>}
        </div>
      </div>
      <div style={{height:'1px',background:'var(--border)',margin:'0 28px'}} />

      {/* LINEUP */}
      <div style={{padding:'36px 28px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'22px'}}>LINEUP</div>
        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
          {LINEUP.map((a,i)=>(
            <div key={i} onClick={()=>navigate('/dj/'+a.handle)}
              style={{display:'flex',alignItems:'center',gap:'16px',padding:'16px',borderRadius:'12px',background:'var(--bg-card)',border:'1px solid var(--border)',cursor:'pointer',transition:'border-color .2s'}}
              onMouseOver={e=>e.currentTarget.style.borderColor='var(--border-hi)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <div style={{width:'50px',height:'50px',borderRadius:'50%',background:'var(--bg-raised)',border:'1px solid var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--gold)',flexShrink:0}}>{a.name[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em',lineHeight:1}}>{a.name}</div>
                <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',marginTop:'3px',letterSpacing:'.04em'}}>{a.tag} · {a.ig}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'6px'}}>
                <span style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--rust)',border:'1px solid rgba(200,90,24,.3)',padding:'3px 10px',borderRadius:'100px',letterSpacing:'.08em'}}>{a.role}</span>
                <ChevronRight size={14} style={{color:'var(--cream-low)'}} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{height:'1px',background:'var(--border)',margin:'0 28px'}} />

      {/* TICKETS */}
      <div style={{padding:'36px 28px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'22px'}}>TICKETS</div>
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {TIERS.map((t,i)=>(
            <div key={i} onClick={()=>t.status==='available'&&handleCheckout(t.id)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 18px',borderRadius:'12px',background:t.status==='available'?'var(--bg-card)':'transparent',border:'1px solid '+(t.status==='available'?'var(--border-hi)':'var(--border)'),cursor:t.status==='available'?'pointer':'default',transition:'border-color .2s'}}
              onMouseOver={e=>{if(t.status==='available')e.currentTarget.style.borderColor='var(--rust)'}} onMouseOut={e=>{if(t.status==='available')e.currentTarget.style.borderColor='var(--border-hi)'}}>
              <div>
                <div style={{fontFamily:'Bebas Neue',fontSize:'18px',color:t.status==='available'?'var(--cream)':'var(--cream-low)',letterSpacing:'.04em'}}>{t.name}</div>
                <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'2px',letterSpacing:'.05em'}}>{t.note}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <span style={{fontFamily:'Bebas Neue',fontSize:'28px',color:t.status==='available'?'var(--cream)':'var(--cream-low)'}}>${t.price}</span>
                {t.status==='available'&&<ArrowRight size={14} style={{color:'var(--rust)'}} />}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{height:'1px',background:'var(--border)',margin:'0 28px'}} />

      {/* EXPERIENCES */}
      <div style={{padding:'36px 28px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'22px'}}>THE EXPERIENCE</div>
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {EXPERIENCES.map((exp,i)=>(
            <div key={i} onClick={()=>navigate('/experience/'+exp.slug)}
              style={{display:'flex',alignItems:'center',gap:'16px',padding:'20px',borderRadius:'12px',background:'var(--bg-card)',border:'1px solid var(--border)',cursor:'pointer',transition:'border-color .2s'}}
              onMouseOver={e=>e.currentTarget.style.borderColor='var(--border-hi)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <span style={{fontSize:'26px',lineHeight:1,flexShrink:0}}>{exp.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:'Bebas Neue',fontSize:'18px',color:'var(--cream)',letterSpacing:'.04em'}}>{exp.label}</div>
                <div style={{fontSize:'12px',color:'var(--cream-mid)',marginTop:'3px',lineHeight:1.4}}>{exp.short}</div>
              </div>
              <ChevronRight size={16} style={{color:'var(--cream-low)',flexShrink:0}} />
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{padding:'36px 28px 120px',borderTop:'1px solid var(--border)',textAlign:'center'}}>
        <div style={{fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--cream)',letterSpacing:'.02em'}}>THE COLLECTIV4</div>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'8px',letterSpacing:'.15em'}}>ART · MUSIC · FASHION · EVENTS</div>
        <div style={{fontSize:'11px',color:'var(--cream-ghost)',marginTop:'12px'}}>@thecollectiv4</div>
      </div>
    </div>
  )
}
