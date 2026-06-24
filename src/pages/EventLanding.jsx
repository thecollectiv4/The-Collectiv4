import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { MapPin, Clock, Calendar, Ticket, Users, Check, ArrowRight, ChevronRight, Loader2, Paintbrush, Frame, Shirt, Layers, Scan, CheckCircle, XCircle, RotateCcw } from 'lucide-react'

const ICON_MAP = { Paintbrush, Frame, Shirt, Layers }

export default function EventLanding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [event, setEvent] = useState(null)
  const [loadingEvent, setLoadingEvent] = useState(true)
  const [attendeeCount, setAttendeeCount] = useState(0)
  const [hasTicket, setHasTicket] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [ticketStatus, setTicketStatus] = useState(null) // 'success' | 'cancelled'

  useEffect(() => {
    const status = searchParams.get('ticket')
    if (status === 'success') setTicketStatus('success')
    if (status === 'cancelled') setTicketStatus('cancelled')
  }, [searchParams])

  // Load the current published event from the DB (multi-event, nothing hardcoded).
  useEffect(() => {
    supabase.from('events').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { setEvent(data && data[0] ? data[0] : null); setLoadingEvent(false) })
      .catch(() => setLoadingEvent(false))
  }, [])

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
  const days = event?.event_date ? Math.max(0, Math.ceil((new Date(event.event_date) - new Date()) / 86400000)) : 0
  const availableTiers = tiers.filter((t) => t.status === 'available')
  const fromPrice = availableTiers.length ? Math.min(...availableTiers.map((t) => t.price)) / 100 : null
  const dateDisplay = event?.event_date
    ? new Date(event.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
    : 'DATE TBA'
  const shortDate = event?.event_date
    ? new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'soon'

  async function handleCheckout(tierId) {
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

  // Scanner state
  const [scannerOpen, setScannerOpen] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeUnlocked, setCodeUnlocked] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scannedList, setScannedList] = useState([])
  const html5QrRef = useRef(null)
  const DOOR_CODE = '4444'

  const startCamera = async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (html5QrRef.current) await html5QrRef.current.stop().catch(() => {})
      const sc = new Html5Qrcode('qr-reader-event')
      html5QrRef.current = sc
      setScanning(true)
      await sc.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
        (text) => { sc.stop().catch(() => {}); setScanning(false); handleScanResult(text.trim().toUpperCase()) },
        () => {}
      )
    } catch (err) { console.log('Camera error:', err) }
  }

  // NOTE: door check-in reads/updates `tickets` client-side with the anon key.
  // Under the new RLS this will be denied — door scanning moves server-side (step 7).
  const handleScanResult = async (qr) => {
    const { data, error } = await supabase.from('tickets').select('*').eq('qr_code', qr).single()
    if (error || !data) {
      setScanResult({ ok: false, msg: 'NOT FOUND', detail: 'Check the code and try again.' })
    } else if (data.checked_in) {
      setScanResult({ ok: false, msg: 'ALREADY IN', detail: data.buyer_name || 'Already scanned' })
    } else {
      await supabase.from('tickets').update({ checked_in: true }).eq('id', data.id)
      setScanResult({ ok: true, msg: 'WELCOME IN', detail: data.buyer_name || data.buyer_email || 'Attendee' })
      setScannedList(prev => [{ name: data.buyer_name || data.buyer_email, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev])
    }
  }

  const resetScan = () => { setScanResult(null); startCamera() }
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
    <div style={{background:'linear-gradient(180deg,#0E0D0C 0%,#0C0B0A 20%,#0A0908 40%,#0A0908 100%)',minHeight:'100vh'}}>

      {/* HEADER */}
      <div style={{position:'fixed',top:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'430px',zIndex:50,background:'rgba(8,8,8,.9)',backdropFilter:'blur(16px)',borderBottom:'1px solid rgba(242,230,208,.08)',padding:'12px 28px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontFamily:'Bebas Neue',fontSize:'16px',color:'#FFFFFF',letterSpacing:'.06em'}}>THE COLLECTIV4</div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#00D54B',animation:'pulse 2s infinite',boxShadow:'0 0 10px rgba(0,213,75,.5)'}}/>
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
              border:'1px solid rgba(255,180,50,.35)',borderRadius:'100px',padding:'6px 16px',
              fontFamily:'DM Mono',fontSize:'10px',color:'#FFB432',letterSpacing:'.1em',
              cursor:'pointer',transition:'all .2s',
              background:'linear-gradient(135deg,rgba(255,180,50,.08),rgba(255,180,50,.03))',
              boxShadow:'0 0 12px rgba(255,180,50,.1)',
            }}
              onMouseOver={e=>{e.currentTarget.style.background='linear-gradient(135deg,rgba(255,180,50,.15),rgba(255,180,50,.08))';e.currentTarget.style.boxShadow='0 0 20px rgba(255,180,50,.15)';e.currentTarget.style.borderColor='rgba(255,180,50,.6)'}}
              onMouseOut={e=>{e.currentTarget.style.background='linear-gradient(135deg,rgba(255,180,50,.08),rgba(255,180,50,.03))';e.currentTarget.style.boxShadow='0 0 12px rgba(255,180,50,.1)';e.currentTarget.style.borderColor='rgba(255,180,50,.35)'}}>
              {event.edition || 'RAN BY ARTISTS'}
            </div>
            {/* Countdown - green accent */}
            <div style={{border:'1px solid rgba(0,213,75,.2)',borderRadius:'100px',padding:'6px 16px',display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',position:'relative',background:'rgba(0,213,75,.04)',animation:'countPulse 3s infinite'}}
              onMouseOver={()=>setShowCountdown(true)} onMouseOut={()=>setShowCountdown(false)}>
              <div style={{width:'5px',height:'5px',borderRadius:'50%',background:'#00D54B',animation:'pulse 2s infinite',boxShadow:'0 0 8px rgba(0,213,75,.5)'}} />
              <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'#50FF80',letterSpacing:'.06em'}}>
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
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',border:'1px solid rgba(74,122,42,.4)',borderRadius:'12px',padding:'18px',background:'rgba(74,122,42,.06)',marginBottom:'12px'}}>
            <Check size={16} style={{color:'#6ABF4A'}} />
            <span style={{color:'#6ABF4A',fontWeight:500,fontSize:'14px'}}>You're in. Check your email for your ticket. See you {shortDate}.</span>
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
            <span style={{color:'#6ABF4A',fontWeight:500,fontSize:'14px'}}>You're in. See you {shortDate}.</span>
          </div>
        ) : (
          <button onClick={()=>setTicketOpen(!ticketOpen)} disabled={checkingOut}
            style={{width:'100%',background:checkingOut?'var(--cream-low)':'linear-gradient(135deg,#F2E6D0,#E0D0B0)',border:'none',borderRadius:'12px',padding:'18px 24px',cursor:checkingOut?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',transition:'all .25s',boxShadow:'0 4px 20px rgba(242,230,208,.12)'}}
            onMouseOver={e=>{if(!checkingOut){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 32px rgba(242,230,208,.2)'}}}
            onMouseOut={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 20px rgba(242,230,208,.12)'}}>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              {checkingOut ? <Loader2 size={18} style={{color:'var(--bg)',animation:'spin 1s linear infinite'}} /> : <Ticket size={18} style={{color:'var(--bg)'}} />}
              <span style={{fontFamily:'Bebas Neue',fontSize:'18px',color:'var(--bg)',letterSpacing:'.06em'}}>{checkingOut ? 'REDIRECTING...' : 'GET YOUR TICKET'}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              {fromPrice != null && <span style={{fontSize:'12px',color:'#6A5040',fontWeight:500}}>from ${fromPrice}</span>}
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
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderRadius:'10px',background:t.status==='available'?'rgba(208,96,32,.06)':'rgba(242,230,208,.02)',border:'1px solid '+(t.status==='available'?'rgba(208,96,32,.25)':'var(--border)'),cursor:t.status==='available'?'pointer':'default',transition:'all .2s'}}
                onMouseOver={e=>{if(t.status==='available'){e.currentTarget.style.borderColor='rgba(208,96,32,.5)';e.currentTarget.style.background='rgba(208,96,32,.12)'}}}
                onMouseOut={e=>{if(t.status==='available'){e.currentTarget.style.borderColor='rgba(208,96,32,.25)';e.currentTarget.style.background='rgba(208,96,32,.06)'}}}>
                <div>
                  <div style={{fontFamily:'Bebas Neue',fontSize:'16px',color:t.status==='available'?'var(--cream)':'var(--cream-low)',letterSpacing:'.04em'}}>{t.name}</div>
                  <div style={{fontFamily:'DM Mono',fontSize:'9px',color:t.status==='available'?'var(--cream-mid)':'var(--cream-low)',marginTop:'2px',letterSpacing:'.05em'}}>{t.note}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <span style={{fontFamily:'Bebas Neue',fontSize:'22px',color:t.status==='available'?'#D06020':'var(--cream-low)'}}>{t.doorLabel||'$'+Math.round(t.price/100)}</span>
                  {t.status==='available'&&<ArrowRight size={12} style={{color:'#D06020'}} />}
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
              style={{display:'flex',alignItems:'center',gap:'16px',padding:'16px',borderRadius:'12px',background:'rgba(242,230,208,.04)',border:'1px solid rgba(242,230,208,.1)',cursor:'pointer',transition:'all .2s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor='rgba(242,230,208,.25)';e.currentTarget.style.background='rgba(242,230,208,.08)'}} onMouseOut={e=>{e.currentTarget.style.borderColor='rgba(242,230,208,.1)';e.currentTarget.style.background='rgba(242,230,208,.04)'}}>
              <div style={{width:'50px',height:'50px',borderRadius:'50%',background:'rgba(208,96,32,.1)',border:'2px solid rgba(208,96,32,.35)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'22px',color:'#D06020',flexShrink:0}}>{a.name[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em',lineHeight:1}}>{a.name}</div>
                <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',marginTop:'3px',letterSpacing:'.04em'}}>{a.tag} · {a.ig}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'6px'}}>
                <span style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream)',background:'rgba(242,230,208,.08)',padding:'4px 12px',borderRadius:'100px',letterSpacing:'.08em',fontWeight:600}}>{a.role}</span>
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
              style={{display:'flex',alignItems:'center',gap:'16px',padding:'18px',borderRadius:'12px',background:exp.bg,border:`1px solid ${exp.accent}30`,cursor:'pointer',transition:'all .2s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor=exp.accent+'60';e.currentTarget.style.background=exp.accent+'18'}} onMouseOut={e=>{e.currentTarget.style.borderColor=exp.accent+'30';e.currentTarget.style.background=exp.bg}}>
              <div style={{width:'44px',height:'44px',borderRadius:'12px',background:exp.accent+'18',border:`1px solid ${exp.accent}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {(()=>{ const IconComp = ICON_MAP[exp.iconName] || Layers; return <IconComp size={20} strokeWidth={1.6} style={{color:exp.accent}} /> })()}
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
      )}

      {/* QR SCANNER */}
      <div style={{padding:'28px',borderTop:'1px solid var(--border)'}}>
        <div onClick={()=>setScannerOpen(!scannerOpen)} style={{cursor:'pointer',textAlign:'center',padding:'12px',transition:'opacity .2s'}}
          onMouseOver={e=>e.currentTarget.style.opacity='.6'} onMouseOut={e=>e.currentTarget.style.opacity='1'}>
          <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',letterSpacing:'.15em'}}>QR SCANNER</div>
        </div>

        {scannerOpen && (
          <div style={{marginTop:'16px',animation:'fadeUp .3s ease'}}>
            {!codeUnlocked ? (
              <div style={{textAlign:'center'}}>
                <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.15em',marginBottom:'16px'}}>ENTER CODE</div>
                <div style={{display:'flex',gap:'8px',justifyContent:'center',marginBottom:'12px'}}>
                  {[0,1,2,3].map(i=>(
                    <input key={i} id={`code-${i}`} type="tel" maxLength={1} inputMode="numeric" value={codeInput[i]||''}
                      style={{width:'48px',height:'56px',textAlign:'center',background:'var(--bg-card)',border:'1px solid var(--border-hi)',borderRadius:'10px',color:'var(--cream)',fontFamily:'Bebas Neue',fontSize:'24px',outline:'none',caretColor:'var(--cream)'}}
                      onFocus={e=>e.currentTarget.style.borderColor='rgba(242,230,208,.3)'}
                      onBlur={e=>e.currentTarget.style.borderColor='var(--border-hi)'}
                      onChange={e=>{
                        const v=e.target.value.replace(/[^0-9]/g,'')
                        const newCode=codeInput.substring(0,i)+v+codeInput.substring(i+1)
                        setCodeInput(newCode)
                        if(v&&i<3){const next=document.getElementById(`code-${i+1}`);if(next)next.focus()}
                        if(newCode.length===4&&newCode===DOOR_CODE){setCodeUnlocked(true);setTimeout(()=>startCamera(),300)}
                      }}
                      onKeyDown={e=>{if(e.key==='Backspace'&&!codeInput[i]&&i>0){const prev=document.getElementById(`code-${i-1}`);if(prev)prev.focus()}}}
                    />
                  ))}
                </div>
                {codeInput.length===4&&codeInput!==DOOR_CODE&&<div style={{fontFamily:'DM Mono',fontSize:'10px',color:'#EF4444'}}>Wrong code</div>}
              </div>
            ) : (
              <div>
                {/* Camera */}
                {!scanResult ? (
                  <div style={{borderRadius:'12px',overflow:'hidden',border:'1px solid var(--border-hi)',background:'#000'}}>
                    <div id="qr-reader-event" style={{width:'100%'}}/>
                    {!scanning&&<div style={{padding:'50px',textAlign:'center',color:'var(--cream-low)',fontSize:'12px'}}>Starting camera...</div>}
                  </div>
                ) : (
                  <div>
                    <div style={{padding:'24px',borderRadius:'12px',border:`1px solid ${scanResult.ok?'rgba(0,213,75,.3)':'rgba(220,38,38,.3)'}`,background:scanResult.ok?'rgba(0,213,75,.06)':'rgba(220,38,38,.06)',textAlign:'center'}}>
                      {scanResult.ok?<CheckCircle size={36} style={{color:'#00D54B',marginBottom:'10px'}}/>:<XCircle size={36} style={{color:'#EF4444',marginBottom:'10px'}}/>}
                      <div style={{fontFamily:'Bebas Neue',fontSize:'24px',color:scanResult.ok?'#00D54B':'#EF4444'}}>{scanResult.msg}</div>
                      <div style={{fontSize:'14px',color:'var(--cream)',fontWeight:600,marginTop:'4px'}}>{scanResult.detail}</div>
                    </div>
                    <button onClick={resetScan} style={{width:'100%',marginTop:'12px',padding:'14px',borderRadius:'10px',background:'rgba(242,230,208,.06)',border:'1px solid var(--border-hi)',color:'var(--cream)',fontSize:'13px',fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',fontFamily:'DM Sans'}}>
                      <RotateCcw size={13}/> Scan Next
                    </button>
                  </div>
                )}

                {/* Scanned list */}
                {scannedList.length>0&&(
                  <div style={{marginTop:'20px'}}>
                    <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.15em',marginBottom:'10px'}}>SCANNED IN ({scannedList.length})</div>
                    <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                      {scannedList.map((s,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:'8px',background:'rgba(0,213,75,.04)',border:'1px solid rgba(0,213,75,.1)'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <CheckCircle size={12} style={{color:'#00D54B'}}/>
                            <span style={{fontSize:'13px',color:'var(--cream)',fontWeight:500}}>{s.name}</span>
                          </div>
                          <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)'}}>{s.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
