import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { useWide } from '@/lib/useIsDesktop'
import { MapPin, Clock, Calendar, Ticket, Users, Check, ArrowRight, ChevronRight, Loader2, MessagesSquare } from 'lucide-react'
import { socialReady, joinEventChat } from '@/lib/social'
import { resolveLineupWorlds, normVibe, vibeMeta, experienceTemp } from '@/lib/match'

/* The root landing: THE house event, from the single source of truth
   (useLiveEvent). The composition itself lives in EventShow — /e/:slug
   dresses ANY published event in the same spread (one room design, many
   rooms — verified members' events included, migration 0016). */
export default function EventLanding() {
  const live = useLiveEvent()
  return <EventShow live={live} />
}

export function EventShow({ live }) {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const wide = useWide()                  // >=1024px: editorial spread, not a stretched phone
  const [searchParams] = useSearchParams()
  const event = live.raw
  const loadingEvent = live.loading
  const [attendeeCount, setAttendeeCount] = useState(0)
  const [attendees, setAttendees] = useState([])   // the guest list — people ARE the content (Ley 6)
  const [hasTicket, setHasTicket] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [ticketStatus, setTicketStatus] = useState(null) // 'success' | 'cancelled'
  const [guestsOpen, setGuestsOpen] = useState(false)    // the full guest list, inline
  const [chatReady, setChatReady] = useState(false)      // room chat live in the DB (0017)
  const [chatBusy, setChatBusy] = useState(false)
  const [chatErr, setChatErr] = useState('')
  // lineup names → live doors to their worlds (D2) — only real matches link
  const [lineupWorlds, setLineupWorlds] = useState(new Map())

  // the room chat door renders only when the layer is live (Ley 9)
  useEffect(() => { socialReady().then(setChatReady) }, [])

  const enterRoomChat = async () => {
    if (chatBusy || !event) return
    setChatBusy(true); setChatErr('')
    try {
      const threadId = await joinEventChat(event.id)
      navigate(`/messages/${threadId}`)
    } catch (e) {
      setChatErr(e?.message || "couldn't open the room — try again")
      setChatBusy(false)
    }
  }

  useEffect(() => {
    const status = searchParams.get('ticket')
    if (status === 'success') setTicketStatus('success')
    if (status === 'cancelled') setTicketStatus('cancelled')
  }, [searchParams])

  // Counts + faces + own-ticket check, scoped to the loaded event. Faces come
  // from the same PII-safe RPC Community renders — real people or nothing
  // (Ley 11: data real o vacío honesto).
  useEffect(() => {
    if (!event) return
    supabase.rpc('confirmed_count', { p_event: event.id }).then(({ data }) => setAttendeeCount(data || 0)).catch(() => setAttendeeCount(0))
    supabase.rpc('confirmed_attendees', { p_event: event.id }).then(({ data }) => setAttendees(data || [])).catch(() => setAttendees([]))
    if (user) {
      supabase.from('tickets').select('id').eq('buyer_id', user.id).eq('event_id', event.id).limit(1)
        .then(({ data }) => setHasTicket(!!(data && data.length))).catch(() => {})
    }
  }, [user, event])

  const tiers = event?.tiers || []
  const lineup = event?.lineup || []
  const experiences = event?.experiences || []
  const vibe = normVibe(event?.vibe)               // the declared character (0021)
  const vMeta = vibe?.kind ? vibeMeta(vibe.kind) : null

  // resolve the lineup against real worlds — the names become doors (D2)
  useEffect(() => {
    let alive = true
    setLineupWorlds(new Map())
    if (!event?.lineup?.length) return
    resolveLineupWorlds(event.lineup).then((m) => { if (alive) setLineupWorlds(m) })
    return () => { alive = false }
  }, [event?.id])
  const days = event?.event_date ? Math.max(0, Math.ceil((new Date(event.event_date) - new Date()) / 86400000)) : 0
  // honest countdown states (Ley 11): a future date counts down, the day-of
  // says TONIGHT, and a past date says nothing at all — never a "0 DAYS"
  // machine readout next to a live buy button
  const eventDate = event?.event_date ? new Date(event.event_date) : null
  const isToday = !!eventDate && eventDate.toDateString() === new Date().toDateString()
  const isFuture = !!eventDate && !isToday && eventDate > new Date()
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
  // Checkout consent — the buyer accepts Terms/Privacy/Refunds before a tier
  // fires. Client-side gate only (the Stripe function is byte-identical): no
  // agreement, no redirect. Refund reality (all sales final) is stated here too.
  const [agreed, setAgreed] = useState(false)
  const [agreeError, setAgreeError] = useState(false)

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

      {/* HEADER — phone only; on wide the Layout header carries the brand */}
      {!wide && <div style={{position:'fixed',top:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'430px',zIndex:50,background:'rgba(10,10,13,.9)',backdropFilter:'blur(16px)',borderBottom:'1px solid rgba(242,238,230,.08)',padding:'12px 28px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontFamily:'Bebas Neue',fontSize:'16px',color:'#F2EEE6',letterSpacing:'.06em'}}>THE COLLECTIV4</div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#C7C9D1',animation:'pulse 2s infinite',boxShadow:'0 0 10px rgba(199,201,209,.5)'}}/>
          <span style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-mid)',letterSpacing:'.08em'}}>LIVE</span>
        </div>
      </div>}

      {/* the editorial frame — one container for every section on wide */}
      <div style={wide ? {maxWidth:'1200px',margin:'0 auto'} : undefined}>

      {/* THE FOLD — on wide, a composed two-column spread: the title block
          left, the door (CTA + who's going) right. No half-screen of
          abandoned void beside the title (Ley 4); everything the 3-second
          question needs lives in one frame (Ley 2). Mobile stacks. */}
      <div style={wide ? {display:'grid',gridTemplateColumns:'minmax(0,1fr) 430px',columnGap:'72px',alignItems:'end',padding:'48px clamp(40px,5vw,72px) 30px',minHeight:'min(56vh, 540px)'} : undefined}>

      {/* HERO title block */}
      <div style={{position:'relative',minHeight: wide ? 0 : '460px',display:'flex',flexDirection:'column',justifyContent:'flex-end',padding: wide ? 0 : '48px 28px 32px'}}>
        {/* Ambient bone glow — one, composed with the title block */}
        <div style={{position:'absolute',top:'60px',left:'-60px',width:'300px',height:'300px',borderRadius:'50%',background:'radial-gradient(circle,rgba(242,238,230,.06) 0%,transparent 70%)',filter:'blur(80px)'}} />
        <div style={{position:'relative',zIndex:2}}>
          <div className="fade-up" style={{display:'flex',gap:'10px',marginBottom:'22px',flexWrap:'wrap'}}>
            {/* Edition badge - golden glow */}
            <div className="pressable" onClick={()=>navigate('/editions')} style={{
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
            {/* Countdown — honest states only: TONIGHT on the day, a real
                count when it's coming, silence when it's past (Ley 11) */}
            {(isToday || isFuture) && (
              <div style={{border:'1px solid rgba(199,201,209,.2)',borderRadius:'100px',padding:'6px 16px',display:'flex',alignItems:'center',gap:'6px',cursor:isFuture?'pointer':'default',position:'relative',background:'rgba(199,201,209,.04)',animation:'countPulse 3s infinite'}}
                onMouseOver={()=>isFuture&&setShowCountdown(true)} onMouseOut={()=>setShowCountdown(false)}>
                <div style={{width:'5px',height:'5px',borderRadius:'50%',background:'#C7C9D1',animation:'pulse 2s infinite',boxShadow:'0 0 8px rgba(199,201,209,.5)'}} />
                <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'#C7C9D1',letterSpacing:'.06em'}}>
                  {isToday ? 'TONIGHT' : showCountdown ? `${countdown.d}D ${countdown.h}H ${countdown.m}M ${countdown.s}S` : `${days} DAYS`}
                </span>
              </div>
            )}
          </div>
          <div className="fade-up-1" style={{fontSize:'10px',letterSpacing:'.3em',color:'var(--cream-mid)',textTransform:'uppercase',fontWeight:600,marginBottom:'14px'}}>The Collectiv4 presents</div>
          <div className="fade-up-2" style={{margin:0,marginBottom:'4px'}}>
            <div style={{display:'flex',alignItems:'baseline',gap: wide ? '20px' : '12px'}}>
              <span style={{fontFamily:'Bebas Neue,sans-serif',fontSize: wide ? 'clamp(120px, 12vw, 168px)' : '82px',lineHeight:.85,letterSpacing:'2px',color:'transparent',WebkitTextStroke:'2px var(--cream)'}}>RAN</span>
              <span style={{fontFamily:'Bebas Neue,sans-serif',fontSize: wide ? '56px' : '32px',lineHeight:1,letterSpacing:'2px',color:'var(--cream)'}}>BY</span>
            </div>
            <div style={{fontFamily:'Bebas Neue,sans-serif',fontSize: wide ? 'clamp(120px, 12vw, 168px)' : '82px',lineHeight:.85,letterSpacing:'2px',color:'var(--cream)',marginTop:'4px'}}>ARTISTS</div>
          </div>
          <p className="fade-up-3" style={{fontSize: wide ? '15px' : '14px',color:'var(--cream-mid)',lineHeight:1.6,marginTop:'16px',maxWidth: wide ? '440px' : '320px'}}>
            {event.tagline || "A night where Houston's artists stop performing for the world and start creating for each other. Sound, paint, and fabric — alive in the same room."}
          </p>
          <div className="fade-up-4" style={{display:'flex',flexWrap:'wrap',gap:'20px',marginTop:'18px'}}>
            {[[Calendar,dateDisplay],[Clock,event.doors||''],[MapPin,(event.venue||'').toUpperCase()]].filter(([,text])=>text).map(([Icon,text],i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                <Icon size={12} strokeWidth={1.4} style={{color:'var(--cream)'}} />
                <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',letterSpacing:'.05em'}}>{text}</span>
              </div>
            ))}
          </div>
          {/* THE CHARACTER — the room's declared temperature + sounds (0021,
              Ley 14: light with meaning). Undeclared events render nothing. */}
          {vibe && (
            <div className="fade-up-4" data-testid="event-vibe" style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:'8px',rowGap:'10px',marginTop:'16px'}}>
              {vMeta && (
                <span className={vMeta.pulse==='warm'?'temp-warm':vMeta.pulse==='electric'?'temp-electric':undefined}
                  style={{display:'inline-flex',alignItems:'center',gap:'8px',border:`1px solid rgba(${vMeta.tint},.4)`,background:`rgba(${vMeta.tint},.06)`,borderRadius:'100px',padding:'6px 14px',boxShadow:`0 0 18px rgba(${vMeta.tint},.14)`}}>
                  <span aria-hidden style={{fontFamily:'DM Mono',fontSize:'10px',color:`rgb(${vMeta.tint})`}}>{vMeta.mark}</span>
                  <span style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--cream)'}}>{vMeta.label}</span>
                </span>
              )}
              {vibe.sound.map((s)=>(
                <span key={s} style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.12em',textTransform:'uppercase',color:'var(--cream-mid)',border:'1px solid rgba(242,238,230,.14)',borderRadius:'100px',padding:'5px 12px'}}>{s}</span>
              ))}
              {vibe.line && <span style={{flexBasis:'100%',fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.06em',fontStyle:'normal'}}>— {vibe.line}</span>}
            </div>
          )}
        </div>
      </div>

      {/* CTA — the right column of the fold on wide; a section on mobile */}
      <div style={{padding: wide ? '0 0 8px' : '0 28px 22px'}}>
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
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',border:'1px solid rgba(242,238,230,.4)',borderRadius:'12px',padding:'18px',background:'rgba(242,238,230,.06)'}}>
              <Check size={16} style={{color:'#C7C9D1'}} />
              <span style={{color:'#C7C9D1',fontWeight:500,fontSize:'14px'}}>You're in. See you {shortDate}.</span>
            </div>
            {/* THE ROOM CHAT — the room that continues (D2, the Base44 steal
                rebuilt). Ticket holders only; the door renders only when the
                layer is live in the DB (Leyes 9, 11). */}
            {chatReady && hasTicket && (
              <>
                <button className="pressable" onClick={enterRoomChat} disabled={chatBusy}
                  style={{marginTop:'10px',width:'100%',display:'flex',alignItems:'center',gap:'12px',background:'rgba(232,233,237,.05)',border:'1px solid rgba(232,233,237,.2)',borderRadius:'12px',padding:'14px 16px',cursor:chatBusy?'default':'pointer',transition:'border-color .2s, background .2s',textAlign:'left'}}
                  onMouseOver={e=>{e.currentTarget.style.borderColor='rgba(232,233,237,.4)';e.currentTarget.style.background='rgba(232,233,237,.09)'}}
                  onMouseOut={e=>{e.currentTarget.style.borderColor='rgba(232,233,237,.2)';e.currentTarget.style.background='rgba(232,233,237,.05)'}}>
                  {chatBusy
                    ? <Loader2 size={16} style={{color:'#E8E9ED',animation:'spin 1s linear infinite',flexShrink:0}} />
                    : <MessagesSquare size={16} strokeWidth={1.6} style={{color:'#E8E9ED',flexShrink:0}} />}
                  <span style={{flex:1,minWidth:0}}>
                    <span style={{display:'block',fontFamily:'Bebas Neue',fontSize:'16px',color:'var(--cream)',letterSpacing:'.05em',lineHeight:1}}>THE ROOM CHAT</span>
                    <span style={{display:'block',fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.08em',marginTop:'4px'}}>outfits, USBs, who's bringing what — the room before the room</span>
                  </span>
                  <ArrowRight size={13} style={{color:'var(--cream-mid)',flexShrink:0}} />
                </button>
                {chatErr && <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'#E5A0A0',marginTop:'8px'}}>⚠ {chatErr}</div>}
              </>
            )}
          </>
        ) : availableTiers.length > 0 ? (
          <button className="pressable" onClick={()=>setTicketOpen(!ticketOpen)} disabled={checkingOut}
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
        ) : (
          /* nothing sellable YET — the brightest element on screen must not
             promise a purchase the tiers below deny (panel catch, Ley 9).
             The state declares itself; the tier catalog stays visible. */
          <div style={{width:'100%',border:'1px solid rgba(242,238,230,.22)',background:'rgba(242,238,230,.05)',borderRadius:'12px',padding:'18px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <Ticket size={18} style={{color:'var(--cream-mid)'}} />
              <span style={{fontFamily:'Bebas Neue',fontSize:'18px',color:'var(--cream)',letterSpacing:'.06em'}}>TICKETS SOON</span>
            </div>
            {tiers.length > 0 && (
              <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',letterSpacing:'.08em'}}>
                {(() => {
                  // the range quotes only tiers whose price the catalog SHOWS —
                  // a doorLabel tier ("AT DOOR") keeps its number off the wall,
                  // so it stays out of the range too (re-panel nit, Ley 11)
                  const ps = tiers.filter(t=>!t.doorLabel).map(t=>t.price).filter(Number.isFinite)
                  const hasDoor = tiers.some(t=>t.doorLabel)
                  if (!ps.length) return 'the room is being priced'
                  const lo = Math.min(...ps)/100, hi = Math.max(...ps)/100
                  const range = lo === hi ? `$${lo}` : `$${lo} – $${hi}`
                  return hasDoor ? `${range} · +door` : range
                })()}
              </span>
            )}
          </div>
        )}
        {/* the coming tiers, visible without a tap when nothing sells yet */}
        {availableTiers.length === 0 && tiers.length > 0 && (
          <div style={{marginTop:'10px',display:'flex',flexDirection:'column',gap:'8px'}}>
            {tiers.map((t,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderRadius:'10px',background:'rgba(242,238,230,.02)',border:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontFamily:'Bebas Neue',fontSize:'15px',color:'var(--cream-low)',letterSpacing:'.04em'}}>{t.name}</div>
                  {t.note && <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'2px',letterSpacing:'.05em'}}>{t.note}</div>}
                </div>
                <span style={{fontFamily:'Bebas Neue',fontSize:'20px',color:'var(--cream-low)'}}>{t.doorLabel||'$'+Math.round(t.price/100)}</span>
              </div>
            ))}
          </div>
        )}
        {/* WHO'S GOING — the guest list, promoted (Ley 6: la gente ES el
            contenido). Real faces from the same PII-safe RPC; tapping opens
            the FULL list right here — each guest is a door to their world.
            When nobody's confirmed yet, just the honest count (Ley 11). */}
        {attendees.length > 0 ? (
          <>
            <div className="pressable" onClick={()=>setGuestsOpen(v=>!v)} role="button" tabIndex={0} aria-expanded={guestsOpen} aria-label="See who's going"
              onKeyDown={(ev)=>{ if (ev.key==='Enter'||ev.key===' ') { ev.preventDefault(); setGuestsOpen(v=>!v) } }}
              style={{marginTop:'14px',padding:'13px 16px',border:'1px solid rgba(242,238,230,.1)',borderRadius:'12px',display:'flex',alignItems:'center',gap:'14px',cursor:'pointer',transition:'border-color .2s, background .2s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor='rgba(242,238,230,.28)';e.currentTarget.style.background='rgba(242,238,230,.03)'}}
              onMouseOut={e=>{e.currentTarget.style.borderColor='rgba(242,238,230,.1)';e.currentTarget.style.background='transparent'}}>
              <div style={{display:'flex',alignItems:'center'}}>
                {attendees.slice(0, wide ? 9 : 6).map((a, i) => {
                  const src = /^https?:\/\//i.test((a.avatar_url||'').trim()) || (a.avatar_url||'').startsWith('data:image/') ? a.avatar_url : ''
                  return (
                    <div key={a.id || i} title={a.name || ''} style={{width:'30px',height:'30px',borderRadius:'50%',overflow:'hidden',border:'1px solid rgba(199,201,209,.5)',background:'var(--bg-card)',marginLeft: i===0?0:'-9px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      {src
                        ? <img src={src} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                        : <span style={{fontFamily:'Bebas Neue',fontSize:'13px',color:'var(--cream)'}}>{(a.name||'?')[0].toUpperCase()}</span>}
                    </div>
                  )
                })}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream)',letterSpacing:'.12em'}}>{attendeeCount} CONFIRMED</div>
                <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.06em',marginTop:'2px'}}>the room is forming</div>
              </div>
              <span style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-mid)',letterSpacing:'.1em',flexShrink:0}}>{guestsOpen ? 'CLOSE ×' : 'SEE WHO →'}</span>
            </div>
            {guestsOpen && (
              <div style={{marginTop:'8px',border:'1px solid rgba(242,238,230,.1)',borderRadius:'12px',padding:'6px 16px',animation:'fadeUp .3s ease'}}>
                {attendees.map((a, i) => {
                  const src = /^https?:\/\//i.test((a.avatar_url||'').trim()) || (a.avatar_url||'').startsWith('data:image/') ? a.avatar_url : ''
                  return (
                    <div key={a.id || i} className="pressable" onClick={()=>a.id&&navigate('/user/'+a.id)} role={a.id?'button':undefined} tabIndex={a.id?0:undefined}
                      onKeyDown={(ev)=>{ if (a.id && (ev.key==='Enter'||ev.key===' ')) { ev.preventDefault(); navigate('/user/'+a.id) } }}
                      style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 0',borderBottom:i<attendees.length-1?'1px solid rgba(242,238,230,.06)':'none',cursor:a.id?'pointer':'default',transition:'padding-left .2s'}}
                      onMouseOver={e=>{if(a.id)e.currentTarget.style.paddingLeft='8px'}}
                      onMouseOut={e=>{e.currentTarget.style.paddingLeft='0'}}>
                      <div style={{width:'30px',height:'30px',borderRadius:'50%',overflow:'hidden',border:'1px solid rgba(199,201,209,.35)',background:'var(--bg-card)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {src
                          ? <img src={src} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                          : <span style={{fontFamily:'Bebas Neue',fontSize:'13px',color:'var(--cream)'}}>{(a.name||'?')[0].toUpperCase()}</span>}
                      </div>
                      <span style={{flex:1,fontSize:'13px',color:'var(--cream)',fontFamily:'DM Sans',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.name||'Guest'}</span>
                      <span style={{fontFamily:'DM Mono',fontSize:'8px',color:'#C7C9D1',letterSpacing:'.14em',flexShrink:0}}>GOING</span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginTop:'12px',fontSize:'11px',color:'var(--cream-low)'}}>
            <Users size={12}/><strong style={{color:'var(--cream-mid)'}}>{attendeeCount}</strong><span>confirmed</span>
          </div>
        )}

        {/* TICKET TIERS - expandable */}
        {ticketOpen && (
          <div style={{marginTop:'16px',display:'flex',flexDirection:'column',gap:'8px',animation:'fadeUp .3s ease'}}>
            {/* consent — the buyer accepts before any available tier can fire.
                Links open in a new tab so the checkout selection isn't lost. */}
            {availableTiers.length > 0 && (
              <div style={{border:`1px solid ${agreeError?'rgba(229,160,160,.5)':'rgba(242,238,230,.14)'}`,borderRadius:'10px',padding:'12px 14px',background:'rgba(242,238,230,.02)',marginBottom:'2px',transition:'border-color .2s'}}>
                <label style={{display:'flex',gap:'10px',alignItems:'flex-start',cursor:'pointer'}}>
                  <input type="checkbox" checked={agreed} onChange={e=>{setAgreed(e.target.checked); if(e.target.checked) setAgreeError(false)}}
                    style={{accentColor:'#F2EEE6',width:'15px',height:'15px',marginTop:'2px',flexShrink:0,cursor:'pointer'}} />
                  <span style={{fontSize:'11px',color:'var(--cream-mid)',lineHeight:1.55}}>
                    I agree to the{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:'var(--cream)',textDecoration:'underline'}}>Terms</a>,{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:'var(--cream)',textDecoration:'underline'}}>Privacy</a>, and{' '}
                    <a href="/refunds" target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:'var(--cream)',textDecoration:'underline'}}>Refund Policy</a>.{' '}
                    <span style={{color:'var(--cream-low)'}}>All sales are final — refunds only if the event is cancelled.</span>
                  </span>
                </label>
                {agreeError && <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'#E5A0A0',letterSpacing:'.06em',marginTop:'8px',paddingLeft:'25px'}}>△ Please accept to continue.</div>}
              </div>
            )}
            {tiers.map((t,i)=>(
              <div key={i} className={t.status==='available' ? 'pressable' : undefined} onClick={()=>{ if(t.status!=='available') return; if(!agreed){ setAgreeError(true); return } handleCheckout(t.id) }}
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

      </div>{/* /the fold */}
      <div style={{height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)',margin:'0 28px'}} />



      {/* LINEUP — the people playing, high in the order (Ley 6) */}
      {lineup.length > 0 && (
      <div style={{padding: wide ? '28px clamp(40px,5vw,72px)' : '26px 28px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream)',textTransform:'uppercase',marginBottom:'16px'}}>LINEUP</div>
        <div style={wide ? {display:'grid',gridTemplateColumns:'repeat(2, minmax(0,1fr))',gap:'12px'} : {display:'flex',flexDirection:'column',gap:'4px'}}>
          {lineup.map((a,i)=>{
            // a lineup name is a LIVE DOOR to its world when the person
            // exists on the platform (D2); otherwise the legacy artist page
            const world = lineupWorlds.get(i)
            const avatar = world && (/^https?:\/\//i.test((world.avatar_url||'').trim()) || (world.avatar_url||'').startsWith('data:image/')) ? world.avatar_url : ''
            return (
            <div key={i} className="pressable" data-testid={world ? 'lineup-world' : 'lineup-artist'} onClick={()=>navigate(world ? '/user/'+world.id : '/artist/'+a.slug)}
              style={{display:'flex',alignItems:'center',gap:'16px',padding:'13px 16px',borderRadius:'12px',background:'rgba(242,238,230,.04)',border:`1px solid ${world?'rgba(232,233,237,.22)':'rgba(242,238,230,.1)'}`,cursor:'pointer',transition:'all .2s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor='rgba(242,238,230,.3)';e.currentTarget.style.background='rgba(242,238,230,.08)'}} onMouseOut={e=>{e.currentTarget.style.borderColor=world?'rgba(232,233,237,.22)':'rgba(242,238,230,.1)';e.currentTarget.style.background='rgba(242,238,230,.04)'}}>
              <div style={{width:'50px',height:'50px',borderRadius:'50%',overflow:'hidden',background:'rgba(242,238,230,.1)',border:`2px solid ${world?'rgba(232,233,237,.55)':'rgba(242,238,230,.35)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'22px',color:'#F2EEE6',flexShrink:0,boxShadow:world?'0 0 14px rgba(232,233,237,.18)':'none'}}>
                {avatar ? <img src={avatar} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : a.name[0]}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em',lineHeight:1}}>{a.name}</div>
                <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',marginTop:'3px',letterSpacing:'.04em'}}>{a.tag} · {a.ig}</div>
                {world && (
                  <div style={{display:'inline-flex',alignItems:'center',gap:'6px',marginTop:'6px',fontFamily:'DM Mono',fontSize:'8px',color:'#E8E9ED',letterSpacing:'.16em',textTransform:'uppercase'}}>
                    <span aria-hidden style={{width:'4px',height:'4px',borderRadius:'50%',background:'#E8E9ED',boxShadow:'0 0 6px rgba(232,233,237,.7)'}} />
                    their world is open →
                  </div>
                )}
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'6px'}}>
                <span style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream)',background:'rgba(242,238,230,.08)',padding:'4px 12px',borderRadius:'100px',letterSpacing:'.08em',fontWeight:600}}>{a.role}</span>
                <ChevronRight size={14} style={{color:'var(--cream-low)'}} />
              </div>
            </div>
          )})}
        </div>
      </div>
      )}
      <div style={{height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)',margin:'0 28px'}} />

      {/* EXPERIENCES — an editorial catalog, not floating icon-boxes (Leyes
          4, 7): numbered hairline entries, signal-dense, the icon serving
          the title instead of wearing a frame */}
      {experiences.length > 0 && (
      <div style={{padding: wide ? '28px clamp(40px,5vw,72px) 36px' : '26px 28px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'6px'}}>THE EXPERIENCE</div>
        <div style={wide ? {display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',columnGap:'44px'} : undefined}>
          {experiences.map((exp,i)=>{
            // each experience wears ITS temperature (Ley 14): live paint
            // glows warm and pulses, sound runs cold-electric, the gallery
            // holds a sober stillness. The icon is a brand MARK in a lit
            // plate — never an explain-me pictogram (Ley 5: the word rides
            // right beside it).
            const temp = experienceTemp(exp)
            const pulseClass = temp.pulse==='warm' ? 'temp-warm' : temp.pulse==='electric' ? 'temp-electric' : undefined
            return (
            <div key={i} className="pressable" data-testid="event-experience" onClick={()=>navigate('/experience/'+exp.slug)}
              style={{display:'flex',alignItems:'center',gap:'14px',padding:'14px 2px',borderBottom:'1px solid rgba(242,238,230,.08)',cursor:'pointer',transition:'padding-left .2s, border-color .2s'}}
              onMouseOver={e=>{e.currentTarget.style.paddingLeft='10px';e.currentTarget.style.borderColor=`rgba(${temp.tint},.3)`}} onMouseOut={e=>{e.currentTarget.style.paddingLeft='2px';e.currentTarget.style.borderColor='rgba(242,238,230,.08)'}}>
              <span style={{fontFamily:'DM Mono',fontSize:'10px',color:`rgba(${temp.tint},.75)`,letterSpacing:'.1em',flexShrink:0}}>{String(i+1).padStart(2,'0')}</span>
              <span aria-hidden className={pulseClass} style={{width:'34px',height:'34px',flexShrink:0,borderRadius:'10px',border:`1px solid rgba(${temp.tint},.32)`,background:`rgba(${temp.tint},.06)`,display:'inline-flex',alignItems:'center',justifyContent:'center',fontFamily:'DM Mono',fontSize:'13px',color:`rgb(${temp.tint})`,boxShadow:`0 0 14px rgba(${temp.tint},.1)`}}>
                {temp.mark}
              </span>
              <div style={{flex:1,minWidth:0}}>
                <span style={{fontFamily:'Bebas Neue',fontSize:'19px',color:'var(--cream)',letterSpacing:'.04em',lineHeight:1}}>{exp.label}</span>
                <div style={{fontSize:'12px',color:'var(--cream-mid)',marginTop:'4px',lineHeight:1.45}}>{exp.short}</div>
              </div>
              <ChevronRight size={14} style={{color:'var(--cream-low)',flexShrink:0,alignSelf:'center'}} />
            </div>
          )})}
        </div>
      </div>
      )}

      {/* FOOTER — mobile: the tab bar's 100px lives on <main>, so the footer
          itself stays close to the last section (Ley 4: no floating island) */}
      <div style={{padding: wide ? '32px 28px 40px' : '30px 28px 36px',borderTop:'1px solid var(--border)',textAlign:'center'}}>
        <div style={{fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--cream)',letterSpacing:'.02em'}}>THE COLLECTIV4</div>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'8px',letterSpacing:'.15em'}}>ART · MUSIC · FASHION · EVENTS</div>
        <div style={{fontSize:'11px',color:'var(--cream-ghost)',marginTop:'12px'}}>@thecollectiv4</div>
        {/* legal — real hrefs (crawlable, right-clickable) with SPA nav */}
        <div style={{display:'flex',justifyContent:'center',gap:'16px',marginTop:'16px',flexWrap:'wrap'}}>
          {[['Terms','/terms'],['Privacy','/privacy'],['Refunds','/refunds']].map(([label,to])=>(
            <a key={to} href={to} onClick={e=>{e.preventDefault();navigate(to)}}
              style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.12em',textTransform:'uppercase',textDecoration:'none',cursor:'pointer'}}>{label}</a>
          ))}
        </div>
      </div>

      </div>{/* /wide frame */}
    </div>
  )
}
