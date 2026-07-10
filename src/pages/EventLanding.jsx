import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { MapPin, Clock, Calendar, Ticket, Users, Check, ArrowRight, ChevronRight, Loader2, Paintbrush, Frame, Shirt, Layers } from 'lucide-react'

const ICON_MAP = { Paintbrush, Frame, Shirt, Layers }

export default function EventLanding() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // The live event comes from the single source of truth (useLiveEvent), not a
  // local fetch — same published-row query, shared with every other surface.
  const live = useLiveEvent()
  const event = live.raw
  const loadingEvent = live.loading
  const [attendeeCount, setAttendeeCount] = useState(0)
  const [hasTicket, setHasTicket] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [ticketStatus, setTicketStatus] = useState(null) // 'success' | 'cancelled'

  useEffect(() => {
    const status = searchParams.get('ticket')
    if (status === 'success') setTicketStatus('success')
    if (status === 'cancelled') setTicketStatus('cancelled')
  }, [searchParams])

  // Counts + own-ticket check, scoped to the loaded event.
  useEffect(() => {
    if (!event) return
    supabase.rpc('confirmed_count', { p_event: event.id }).then(({ data }) => setAttendeeCount(data || 0)).catch(() => setAttendeeCount(0))
    if (user) {
      supabase.from('tickets').select('id').eq('buyer_id', user.id).eq('event_id', event.id).limit(1)
        .then(({ data }) => setHasTicket(!!(data && data.length))).catch(() => {})
    }
  }, [user, event])

  const tiers = event?.tiers || []
  const lineup = event?.lineup || []
  const experiences = event?.experiences || []
  // Cosmos: neutralize warm per-experience accents that arrive in event data.
  // Visual override only, no data change. (Cool per-artist accents are left as-is.)
  const EXP_ACCENT = '#C7C9D1'
  const EXP_BG = 'rgba(242,238,230,.03)'
  const days = event?.event_date ? Math.max(0, Math.ceil((new Date(event.event_date) - new Date()) / 86400000)) : 0
  const availableTiers = tiers.filter((t) => t.status === 'available')
  const fromPrice = availableTiers.length ? Math.min(...availableTiers.map((t) => t.price)) / 100 : null
  const dateDisplay = live.dateLong.toUpperCase()   // "JUNE 13, 2026" / "DATE TBA"
  const shortDate = live.dateShort                  // "Jun 13" / "soon"

  async function handleCheckout(tierId) {
    // Session still rehydrating (hard load + instant click) — ignore the click
    // rather than bounce a signed-in buyer to /auth. The window is milliseconds.
    if (authLoading) return
    if (!user) { navigate('/auth'); return }
    if (!event) return
    setCheckingOut(true)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug: event.slug, tier: tierId, email: user.email, userName: user.user_metadata?.full_name || '', userId: user.id }),
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
  const [ticketOpen, setTicketOpen] = useState(false)

  // Door check-in moved to /door — network-only, server-gated (migration 0013).
  // Nothing scanner-shaped (and no client secret) ships on the public landing.
  const [countdown, setCountdown] = useState({d:0,h:0,m:0,s:0})

  useEffect(() => {
    if (!event?.event_date) return
    const target = new Date(event.event_date)
    const tick = () => {
      const diff = target - new Date()
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
  }, [event])

  if (loadingEvent) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
        <Loader2 size={22} style={{color:'var(--cream-low)',animation:'spin 1s linear infinite'}} />
      </div>
    )
  }

  if (!event) {
    return (
      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 28px',textAlign:'center',background:'var(--bg)'}}>
        <Calendar size={24} strokeWidth={1.2} style={{color:'var(--cream-low)',marginBottom:'18px'}}/>
        <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em',marginBottom:'8px'}}>NO UPCOMING EVENTS</div>
        <div style={{fontSize:'13px',color:'var(--cream-low)',lineHeight:1.6}}>Something is coming. Stay close.</div>
      </div>
    )
  }

  return (
    <div style={{background:'radial-gradient(120% 80% at 50% -10%, rgba(242,238,230,.05) 0%, rgba(242,238,230,0) 55%), #0A0A0D',minHeight:'100vh'}}>

      {/* HEADER */}
      <div style={{position:'fixed',top:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'430px',zIndex:50,background:'rgba(10,10,13,.9)',backdropFilter:'blur(16px)',borderBottom:'1px solid rgba(242,238,230,.08)',padding:'12px 28px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontFamily:'Bebas Neue',fontSize:'16px',color:'#F2EEE6',letterSpacing:'.06em'}}>THE COLLECTIV4</div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#C7C9D1',animation:'pulse 2s infinite',boxShadow:'0 0 10px rgba(199,201,209,.5)'}}/>
          <span style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-mid)',letterSpacing:'.08em'}}>LIVE</span>
        </div>
      </div>

      {/* HERO */}
      <div style={{position:'relative',minHeight:'540px',display:'flex',flexDirection:'column',justifyContent:'flex-end',padding:'0 28px 44px',paddingTop:'48px'}}>
        {/* Ambient bone glow */}
        <div style={{position:'absolute',top:'40px',left:'-60px',width:'300px',height:'300px',borderRadius:'50%',background:'radial-gradient(circle,rgba(242,238,230,.07) 0%,transparent 70%)',filter:'blur(80px)'}} />
        <div style={{position:'absolute',top:'200px',right:'-40px',width:'250px',height:'250px',borderRadius:'50%',background:'radial-gradient(circle,rgba(242,238,230,.04) 0%,transparent 70%)',filter:'blur(70px)'}} />
        <div style={{position:'absolute',bottom:'0',left:'30%',width:'300px',height:'300px',borderRadius:'50%',background:'radial-gradient(circle,rgba(242,238,230,.05) 0%,transparent 70%)',filter:'blur(90px)'}} />
        <div style={{position:'relative',zIndex:2}}>
          <div className="fade-up" style={{display:'flex',gap:'10px',marginBottom:'36px',flexWrap:'wrap'}}>
            {/* Edition badge - golden glow */}
            <div onClick={()=>navigate('/editions')} style={{
              border:'1px solid rgba(242,238,230,.35)',borderRadius:'100px',padding:'6px 16px',
              fontFamily:'DM Mono',fontSize:'10px',color:'#F2EEE6',letterSpacing:'.1em',
              cursor:'pointer',transition:'all .2s',
              background:'linear-gradient(135deg,rgba(242,238,230,.08),rgba(242,238,230,.03))',
              boxShadow:'0 0 12px rgba(242,238,230,.1)',
            }}
              onMouseOver={e=>{e.currentTarget.style.background='linear-gradient(135deg,rgba(242,238,230,.15),rgba(242,238,230,.08))';e.currentTarget.style.boxShadow='0 0 20px rgba(242,238,230,.15)';e.currentTarget.style.borderColor='rgba(242,238,230,.6)'}}
              onMouseOut={e=>{e.currentTarget.style.background='linear-gradient(135deg,rgba(242,238,230,.08),rgba(242,238,230,.03))';e.currentTarget.style.boxShadow='0 0 12px rgba(242,238,230,.1)';e.currentTarget.style.borderColor='rgba(242,238,230,.35)'}}>
              {event.edition || 'RAN BY ARTISTS'}
            </div>
            {/* Countdown - green accent */}
            <div style={{border:'1px solid rgba(199,201,209,.2)',borderRadius:'100px',padding:'6px 16px',display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',position:'relative',background:'rgba(199,201,209,.04)',animation:'countPulse 3s infinite'}}
              onMouseOver={()=>setShowCountdown(true)} onMouseOut={()=>setShowCountdown(false)}>
              <div style={{width:'5px',height:'5px',borderRadius:'50%',background:'#C7C9D1',animation:'pulse 2s infinite',boxShadow:'0 0 8px rgba(199,201,209,.5)'}} />
              <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'#C7C9D1',letterSpacing:'.06em'}}>
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
            {event.tagline || "A night where Houston's artists stop performing for the world and start creating for each other. Sound, paint, and fabric — alive in the same room."}
          </p>
          <div className="fade-up-4" style={{display:'flex',flexWrap:'wrap',gap:'20px',marginTop:'26px'}}>
            {[[Calendar,dateDisplay],[Clock,event.doors||''],[MapPin,(event.venue||'').toUpperCase()]].filter(([,text])=>text).map(([Icon,text],i)=>(
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
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',border:'1px solid rgba(242,238,230,.4)',borderRadius:'12px',padding:'18px',background:'rgba(242,238,230,.06)',marginBottom:'12px'}}>
            <Check size={16} style={{color:'#C7C9D1'}} />
            <span style={{color:'#C7C9D1',fontWeight:500,fontSize:'14px'}}>You're in. Check your email for your ticket. See you {shortDate}.</span>
          </div>
        )}
        {ticketStatus === 'cancelled' && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',border:'1px solid rgba(229,160,160,.4)',borderRadius:'12px',padding:'18px',background:'rgba(229,160,160,.06)',marginBottom:'12px'}}>
            <span style={{color:'var(--rust)',fontWeight:500,fontSize:'14px'}}>Checkout cancelled. No charge was made.</span>
          </div>
        )}
        {hasTicket || ticketStatus === 'success' ? (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',border:'1px solid rgba(242,238,230,.4)',borderRadius:'12px',padding:'18px',background:'rgba(242,238,230,.06)'}}>
            <Check size={16} style={{color:'#C7C9D1'}} />
            <span style={{color:'#C7C9D1',fontWeight:500,fontSize:'14px'}}>You're in. See you {shortDate}.</span>
          </div>
        ) : (
          <button onClick={()=>setTicketOpen(!ticketOpen)} disabled={checkingOut}
            style={{width:'100%',background:checkingOut?'var(--cream-low)':'#F2EEE6',border:'none',borderRadius:'12px',padding:'18px 24px',cursor:checkingOut?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',transition:'all .25s',boxShadow:'0 4px 20px rgba(242,238,230,.12)'}}
            onMouseOver={e=>{if(!checkingOut){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 32px rgba(242,238,230,.2)'}}}
            onMouseOut={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 20px rgba(242,238,230,.12)'}}>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              {checkingOut ? <Loader2 size={18} style={{color:'var(--bg)',animation:'spin 1s linear infinite'}} /> : <Ticket size={18} style={{color:'var(--bg)'}} />}
              <span style={{fontFamily:'Bebas Neue',fontSize:'18px',color:'var(--bg)',letterSpacing:'.06em'}}>{checkingOut ? 'REDIRECTING...' : 'GET YOUR TICKET'}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              {fromPrice != null && <span style={{fontSize:'12px',color:'rgba(10,10,13,.55)',fontWeight:500}}>from ${fromPrice}</span>}
              <ArrowRight size={14} style={{color:'var(--bg)'}} />
            </div>
          </button>
        )}
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginTop:'12px',fontSize:'11px',color:'var(--cream-low)'}}>
          <Users size={12}/><strong style={{color:'var(--cream-mid)'}}>{attendeeCount}</strong><span>confirmed</span>
          {user&&<span onClick={()=>navigate('/community')} style={{color:'var(--cream)',cursor:'pointer',marginLeft:'4px',transition:'opacity .2s'}} onMouseOver={e=>e.currentTarget.style.opacity='.7'} onMouseOut={e=>e.currentTarget.style.opacity='1'}>· See who →</span>}
        </div>

        {/* TICKET TIERS - expandable */}
        {ticketOpen && (
          <div style={{marginTop:'16px',display:'flex',flexDirection:'column',gap:'8px',animation:'fadeUp .3s ease'}}>
            {tiers.map((t,i)=>(
              <div key={i} onClick={()=>t.status==='available'&&handleCheckout(t.id)}
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderRadius:'10px',background:t.status==='available'?'rgba(242,238,230,.06)':'rgba(242,238,230,.02)',border:'1px solid '+(t.status==='available'?'rgba(242,238,230,.25)':'var(--border)'),cursor:t.status==='available'?'pointer':'default',transition:'all .2s'}}
                onMouseOver={e=>{if(t.status==='available'){e.currentTarget.style.borderColor='rgba(242,238,230,.5)';e.currentTarget.style.background='rgba(242,238,230,.12)'}}}
                onMouseOut={e=>{if(t.status==='available'){e.currentTarget.style.borderColor='rgba(242,238,230,.25)';e.currentTarget.style.background='rgba(242,238,230,.06)'}}}>
                <div>
                  <div style={{fontFamily:'Bebas Neue',fontSize:'16px',color:t.status==='available'?'var(--cream)':'var(--cream-low)',letterSpacing:'.04em'}}>{t.name}</div>
                  <div style={{fontFamily:'DM Mono',fontSize:'9px',color:t.status==='available'?'var(--cream-mid)':'var(--cream-low)',marginTop:'2px',letterSpacing:'.05em'}}>{t.note}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <span style={{fontFamily:'Bebas Neue',fontSize:'22px',color:t.status==='available'?'#F2EEE6':'var(--cream-low)'}}>{t.doorLabel||'$'+Math.round(t.price/100)}</span>
                  {t.status==='available'&&<ArrowRight size={12} style={{color:'#F2EEE6'}} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)',margin:'0 28px'}} />



      {/* LINEUP */}
      {lineup.length > 0 && (
      <div style={{padding:'36px 28px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream)',textTransform:'uppercase',marginBottom:'22px'}}>LINEUP</div>
        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
          {lineup.map((a,i)=>(
            <div key={i} onClick={()=>navigate('/artist/'+a.slug)}
              style={{display:'flex',alignItems:'center',gap:'16px',padding:'16px',borderRadius:'12px',background:'rgba(242,238,230,.04)',border:'1px solid rgba(242,238,230,.1)',cursor:'pointer',transition:'all .2s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor='rgba(242,238,230,.25)';e.currentTarget.style.background='rgba(242,238,230,.08)'}} onMouseOut={e=>{e.currentTarget.style.borderColor='rgba(242,238,230,.1)';e.currentTarget.style.background='rgba(242,238,230,.04)'}}>
              <div style={{width:'50px',height:'50px',borderRadius:'50%',background:'rgba(242,238,230,.1)',border:'2px solid rgba(242,238,230,.35)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'22px',color:'#F2EEE6',flexShrink:0}}>{a.name[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em',lineHeight:1}}>{a.name}</div>
                <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',marginTop:'3px',letterSpacing:'.04em'}}>{a.tag} · {a.ig}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'6px'}}>
                <span style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream)',background:'rgba(242,238,230,.08)',padding:'4px 12px',borderRadius:'100px',letterSpacing:'.08em',fontWeight:600}}>{a.role}</span>
                <ChevronRight size={14} style={{color:'var(--cream-low)'}} />
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
      <div style={{height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)',margin:'0 28px'}} />

      {/* EXPERIENCES */}
      {experiences.length > 0 && (
      <div style={{padding:'36px 28px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'22px'}}>THE EXPERIENCE</div>
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {experiences.map((exp,i)=>(
            <div key={i} onClick={()=>navigate('/experience/'+exp.slug)}
              style={{display:'flex',alignItems:'center',gap:'16px',padding:'18px',borderRadius:'12px',background:EXP_BG,border:`1px solid ${EXP_ACCENT}30`,cursor:'pointer',transition:'all .2s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor=EXP_ACCENT+'60';e.currentTarget.style.background=EXP_ACCENT+'18'}} onMouseOut={e=>{e.currentTarget.style.borderColor=EXP_ACCENT+'30';e.currentTarget.style.background=EXP_BG}}>
              <div style={{width:'44px',height:'44px',borderRadius:'12px',background:EXP_ACCENT+'18',border:`1px solid ${EXP_ACCENT}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {(()=>{ const IconComp = ICON_MAP[exp.iconName] || Layers; return <IconComp size={20} strokeWidth={1.6} style={{color:EXP_ACCENT}} /> })()}
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'Bebas Neue',fontSize:'18px',color:'var(--cream)',letterSpacing:'.04em'}}>{exp.label}</div>
                <div style={{fontSize:'12px',color:'var(--cream-mid)',marginTop:'3px',lineHeight:1.4}}>{exp.short}</div>
              </div>
              <ChevronRight size={16} style={{color:EXP_ACCENT,flexShrink:0}} />
            </div>
          ))}
        </div>
      </div>
      )}

      {/* FOOTER */}
      <div style={{padding:'36px 28px 120px',borderTop:'1px solid var(--border)',textAlign:'center'}}>
        <div style={{fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--cream)',letterSpacing:'.02em'}}>THE COLLECTIV4</div>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'8px',letterSpacing:'.15em'}}>ART · MUSIC · FASHION · EVENTS</div>
        <div style={{fontSize:'11px',color:'var(--cream-ghost)',marginTop:'12px'}}>@thecollectiv4</div>
      </div>
    </div>
  )
}
