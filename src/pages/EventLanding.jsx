import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { MapPin, Clock, Calendar, Ticket, Users, Check, ArrowRight, ChevronRight, Loader2, Paintbrush, Frame, Shirt, Layers } from 'lucide-react'

const ICON_MAP = { Paintbrush, Frame, Shirt, Layers }

const LINEUP = [
  { handle:'madou', slug:'madou', name:'MADOU', role:'DJ SET', tag:'House · Deep', ig:'@natemadou' },
  { handle:'patoduranc', slug:'pato-duran', name:'PATO', role:'DJ SET', tag:'House · Techno', ig:'@patoduranc' },
]
const EXPERIENCES = [
  { slug:'live-art', label:'LIVE ART', short:'Paintings created in real time as the music plays.', iconName:'Paintbrush', accent:'#D06020', bg:'rgba(208,96,32,.04)' },
  { slug:'gallery', label:'GALLERY', short:'Original works by the painter on display. Art you can feel.', iconName:'Frame', accent:'#8A2040', bg:'rgba(138,32,64,.04)' },
  { slug:'fashion', label:'FASHION POP-UP', short:'Local Houston designers. Wearable culture.', iconName:'Shirt', accent:'#D4A040', bg:'rgba(212,160,64,.04)' },
  { slug:'screen-printing', label:'SCREEN PRINTING', short:'Custom prints made live. Leave with something that only exists tonight.', iconName:'Layers', accent:'#5A9A30', bg:'rgba(90,122,58,.04)' },
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

  const [showCountdown, setShowCountdown] = useState(false)
  const [countdown, setCountdown] = useState({d:0,h:0,m:0,s:0})

  useEffect(() => {
    const tick = () => {
      const diff = new Date('2026-05-30T22:00:00-05:00') - new Date()
      if (diff <= 0) return
      setCountdown({
        d: Math.floor(diff/86400000),
        h: Math.floor((diff%86400000)/3600000),
        m: Math.floor((diff%3600000)/60000),
        s: Math.floor((diff%60000)/1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{background:'linear-gradient(180deg,#0E0D0C 0%,#0C0B0A 20%,#0A0908 40%,#0A0908 100%)',minHeight:'100vh'}}>

      {/* HEADER */}
      <div style={{position:'fixed',top:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'430px',zIndex:50,background:'rgba(8,8,8,.9)',backdropFilter:'blur(16px)',borderBottom:'1px solid rgba(242,230,208,.08)',padding:'12px 28px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontFamily:'Bebas Neue',fontSize:'16px',color:'var(--cream)',letterSpacing:'.06em'}}>THE COLLECTIV4</div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#F2E6D0',animation:'pulse 2s infinite',boxShadow:'0 0 8px rgba(242,230,208,.4)'}}/>
          <span style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-mid)',letterSpacing:'.08em'}}>LIVE</span>
        </div>
      </div>

      {/* HERO */}
      <div style={{position:'relative',minHeight:'540px',display:'flex',flexDirection:'column',justifyContent:'flex-end',padding:'0 28px 44px',paddingTop:'48px'}}>
        {/* Ambient warm glow */}
        <div style={{position:'absolute',top:'40px',left:'-60px',width:'300px',height:'300px',borderRadius:'50%',background:'radial-gradient(circle,rgba(242,230,208,.07) 0%,transparent 70%)',filter:'blur(80px)'}} />
        <div style={{position:'absolute',top:'200px',right:'-40px',width:'250px',height:'250px',borderRadius:'50%',background:'radial-gradient(circle,rgba(242,230,208,.04) 0%,transparent 70%)',filter:'blur(70px)'}} />
        <div style={{position:'absolute',bottom:'0',left:'30%',width:'300px',height:'300px',borderRadius:'50%',background:'radial-gradient(circle,rgba(242,230,208,.05) 0%,transparent 70%)',filter:'blur(90px)'}} />
        <div style={{position:'relative',zIndex:2}}>
          <div className="fade-up" style={{display:'flex',gap:'10px',marginBottom:'36px',flexWrap:'wrap'}}>
            {/* Edition badge - golden glow */}
            <div onClick={()=>navigate('/editions')} style={{
              border:'1px solid rgba(242,230,208,.3)',borderRadius:'100px',padding:'6px 16px',
              fontFamily:'DM Mono',fontSize:'10px',color:'#F2E6D0',letterSpacing:'.1em',
              cursor:'pointer',transition:'all .2s',
              background:'linear-gradient(135deg,rgba(242,230,208,.06),rgba(242,230,208,.03))',
              boxShadow:'0 0 12px rgba(242,230,208,.06)',
            }}
              onMouseOver={e=>{e.currentTarget.style.background='linear-gradient(135deg,rgba(242,230,208,.15),rgba(242,230,208,.08))';e.currentTarget.style.boxShadow='0 0 20px rgba(242,230,208,.12)';e.currentTarget.style.borderColor='rgba(242,230,208,.5)'}}
              onMouseOut={e=>{e.currentTarget.style.background='linear-gradient(135deg,rgba(242,230,208,.06),rgba(242,230,208,.03))';e.currentTarget.style.boxShadow='0 0 12px rgba(242,230,208,.06)';e.currentTarget.style.borderColor='rgba(242,230,208,.3)'}}>
              EDITION 002
            </div>
            {/* Countdown - green accent */}
            <div style={{border:'1px solid rgba(242,230,208,.15)',borderRadius:'100px',padding:'6px 16px',display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',position:'relative',background:'rgba(242,230,208,.03)',animation:'countPulse 3s infinite'}}
              onMouseOver={()=>setShowCountdown(true)} onMouseOut={()=>setShowCountdown(false)}>
              <div style={{width:'5px',height:'5px',borderRadius:'50%',background:'#F2E6D0',animation:'pulse 2s infinite',boxShadow:'0 0 6px rgba(242,230,208,.4)'}} />
              <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream)',letterSpacing:'.06em'}}>
                {showCountdown ? `${countdown.d}D ${countdown.h}H ${countdown.m}M ${countdown.s}S` : `${days} DAYS`}
              </span>
            </div>
          </div>
          <div className="fade-up-1" style={{fontSize:'10px',letterSpacing:'.3em',color:'var(--cream-mid)',textTransform:'uppercase',fontWeight:600,marginBottom:'14px'}}>The Collectiv4 presents</div>
          <div className="fade-up-2" style={{margin:0,marginBottom:'4px'}}>
            <div style={{display:'flex',alignItems:'baseline',gap:'12px'}}>
              <span style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'82px',lineHeight:.85,letterSpacing:'2px',color:'transparent',WebkitTextStroke:'2px var(--cream)'}}>RAN</span>
              <span style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'32px',lineHeight:1,letterSpacing:'2px',color:'var(--cream)'}}>BY</span>
            </div>
            <div style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'82px',lineHeight:.85,letterSpacing:'2px',color:'var(--cream)',marginTop:'4px'}}>ARTISTS</div>
          </div>
          <p className="fade-up-3" style={{fontSize:'14px',color:'var(--cream-mid)',lineHeight:1.65,marginTop:'22px',maxWidth:'320px'}}>
            A night where Houston's artists stop performing for the world and start creating for each other. Sound, paint, and fabric — alive in the same room.
          </p>
          <div className="fade-up-4" style={{display:'flex',flexWrap:'wrap',gap:'20px',marginTop:'26px'}}>
            {[[Calendar,'MAY 30, 2026'],[Clock,'10PM — 2AM'],[MapPin,'HOUSTON · TBA']].map(([Icon,text],i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                <Icon size={12} strokeWidth={1.4} style={{color:'var(--cream)'}} />
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
            style={{width:'100%',background:checkingOut?'var(--cream-low)':'linear-gradient(135deg,#F2E6D0,#E0D0B0)',border:'none',borderRadius:'12px',padding:'18px 24px',cursor:checkingOut?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',transition:'all .25s',boxShadow:'0 4px 20px rgba(242,230,208,.12)'}}
            onMouseOver={e=>{if(!checkingOut){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 32px rgba(242,230,208,.2)'}}}
            onMouseOut={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 20px rgba(242,230,208,.12)'}}>
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
          {user&&<span onClick={()=>navigate('/attendees')} style={{color:'var(--cream)',cursor:'pointer',marginLeft:'4px',transition:'opacity .2s'}} onMouseOver={e=>e.currentTarget.style.opacity='.7'} onMouseOut={e=>e.currentTarget.style.opacity='1'}>· See who →</span>}
        </div>
      </div>
      <div style={{height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)',margin:'0 28px'}} />

      {/* LINEUP */}
      <div style={{padding:'36px 28px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--rust)',textTransform:'uppercase',marginBottom:'22px'}}>LINEUP</div>
        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
          {LINEUP.map((a,i)=>(
            <div key={i} onClick={()=>navigate('/artist/'+a.slug)}
              style={{display:'flex',alignItems:'center',gap:'16px',padding:'16px',borderRadius:'12px',background:'var(--bg-card)',border:'1px solid var(--border-hi)',cursor:'pointer',transition:'all .2s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor='var(--rust)';e.currentTarget.style.background='var(--rust-dim)'}} onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border-hi)';e.currentTarget.style.background='var(--bg-card)'}}>
              <div style={{width:'50px',height:'50px',borderRadius:'50%',background:'var(--rust-dim)',border:'2px solid var(--rust)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--rust)',flexShrink:0}}>{a.name[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em',lineHeight:1}}>{a.name}</div>
                <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',marginTop:'3px',letterSpacing:'.04em'}}>{a.tag} · {a.ig}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'6px'}}>
                <span style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--rust)',background:'var(--rust-dim)',padding:'4px 12px',borderRadius:'100px',letterSpacing:'.08em',fontWeight:600}}>{a.role}</span>
                <ChevronRight size={14} style={{color:'var(--rust)'}} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)',margin:'0 28px'}} />

      {/* TICKETS */}
      <div style={{padding:'36px 28px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--gold)',textTransform:'uppercase',marginBottom:'22px'}}>TICKETS</div>
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {TIERS.map((t,i)=>(
            <div key={i} onClick={()=>t.status==='available'&&handleCheckout(t.id)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 18px',borderRadius:'12px',background:t.status==='available'?'var(--rust-dim)':'transparent',border:'1px solid '+(t.status==='available'?'rgba(208,96,32,.3)':'var(--border)'),cursor:t.status==='available'?'pointer':'default',transition:'all .2s'}}
              onMouseOver={e=>{if(t.status==='available'){e.currentTarget.style.borderColor='var(--rust)';e.currentTarget.style.background='rgba(208,96,32,.18)'}}} onMouseOut={e=>{if(t.status==='available'){e.currentTarget.style.borderColor='rgba(208,96,32,.3)';e.currentTarget.style.background='var(--rust-dim)'}}}>
              <div>
                <div style={{fontFamily:'Bebas Neue',fontSize:'18px',color:t.status==='available'?'var(--cream)':'var(--cream-low)',letterSpacing:'.04em'}}>{t.name}</div>
                <div style={{fontFamily:'DM Mono',fontSize:'9px',color:t.status==='available'?'var(--cream-mid)':'var(--cream-low)',marginTop:'2px',letterSpacing:'.05em'}}>{t.note}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <span style={{fontFamily:'Bebas Neue',fontSize:'28px',color:t.status==='available'?'var(--rust)':'var(--cream-low)'}}>${t.price}</span>
                {t.status==='available'&&<ArrowRight size={14} style={{color:'var(--rust)'}} />}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)',margin:'0 28px'}} />

      {/* EXPERIENCES */}
      <div style={{padding:'36px 28px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'22px'}}>THE EXPERIENCE</div>
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {EXPERIENCES.map((exp,i)=>(
            <div key={i} onClick={()=>navigate('/experience/'+exp.slug)}
              style={{display:'flex',alignItems:'center',gap:'16px',padding:'18px',borderRadius:'12px',background:exp.bg,border:`1px solid ${exp.accent}30`,cursor:'pointer',transition:'all .2s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor=exp.accent+'60';e.currentTarget.style.background=exp.accent+'18'}} onMouseOut={e=>{e.currentTarget.style.borderColor=exp.accent+'30';e.currentTarget.style.background=exp.bg}}>
              <div style={{width:'44px',height:'44px',borderRadius:'12px',background:exp.accent+'18',border:`1px solid ${exp.accent}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {(()=>{ const IconComp = ICON_MAP[exp.iconName]; return <IconComp size={20} strokeWidth={1.6} style={{color:exp.accent}} /> })()}
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'Bebas Neue',fontSize:'18px',color:'var(--cream)',letterSpacing:'.04em'}}>{exp.label}</div>
                <div style={{fontSize:'12px',color:'var(--cream-mid)',marginTop:'3px',lineHeight:1.4}}>{exp.short}</div>
              </div>
              <ChevronRight size={16} style={{color:exp.accent,flexShrink:0}} />
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
