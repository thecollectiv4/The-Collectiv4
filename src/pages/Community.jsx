import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { Lock, Send, MessageCircle, Users, Ticket, ArrowLeft } from 'lucide-react'

export default function Community() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('going')
  const [attendees, setAttendees] = useState([])
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [hasTicket, setHasTicket] = useState(false)
  const bottomRef = useRef(null)

  // Map known emails to artist profile slugs
  const artistMap = {
    'dievillovalle@gmail.com': 'diego-villasenor',
    'patduranchacon@icloud.com': 'pato-duran',
    'patduranchacon@gmail.com': 'pato-duran',
    'natemadou@gmail.com': 'madou',
  }
  const getProfileLink = (a) => {
    if (artistMap[a.buyer_email]) return '/artist/' + artistMap[a.buyer_email]
    return '/user/' + a.buyer_id
  }

  useEffect(() => {
    supabase.from('tickets').select('*').eq('status','confirmed').order('created_at',{ascending:false})
      .then(({data}) => { setAttendees(data||[]); setLoading(false) })
      .catch(() => setLoading(false))

    supabase.from('chat_messages').select('*').order('created_at',{ascending:true}).limit(100)
      .then(({data}) => setMessages(data||[]))
      .catch(() => {})

    const channel = supabase.channel('community-chat').on('postgres_changes',
      { event:'INSERT', schema:'public', table:'chat_messages' },
      (payload) => setMessages(prev => [...prev, payload.new])
    ).subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => { if(tab==='chat'&&open) bottomRef.current?.scrollIntoView({behavior:'smooth'}) }, [messages, tab, open])

  const send = async () => {
    if (!newMsg.trim() || !user) return
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Attendee'
    const msg = { user_id: user.id, sender_name: name, text: newMsg.trim(), created_at: new Date().toISOString() }
    setNewMsg('')
    const { error } = await supabase.from('chat_messages').insert(msg)
    if (error) setMessages(prev => [...prev, { ...msg, id: Date.now() }])
  }

  if (!user) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 28px',textAlign:'center',background:'var(--bg)'}}>
      <Lock size={24} strokeWidth={1.2} style={{color:'var(--cream-low)',marginBottom:'20px'}}/>
      <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',marginBottom:'8px'}}>JOIN THE COMMUNITY</div>
      <div style={{fontSize:'13px',color:'var(--cream-mid)',marginBottom:'28px',lineHeight:1.6}}>Get your ticket to connect with other attendees.</div>
      <button onClick={()=>navigate('/auth')} style={{background:'var(--cream)',border:'none',borderRadius:'10px',padding:'14px 36px',color:'var(--bg)',fontFamily:'DM Sans',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Join</button>
    </div>
  )

  // CLOSED STATE — ticket or locked
  if (!open) return (
    <div style={{background:'linear-gradient(180deg,#0E0D0C 0%,#0C0B0A 20%,#0A0908 40%,#0A0908 100%)',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'28px'}}>
      <div style={{position:'relative',width:'100%',maxWidth:'360px'}}>
        {/* Blur overlay text when no ticket */}
        {!hasTicket && (
          <div style={{position:'absolute',inset:0,zIndex:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'20px',borderRadius:'20px'}}>
            <div style={{fontFamily:'Bebas Neue',fontSize:'32px',color:'#FFFFFF',textAlign:'center',letterSpacing:'.02em',textShadow:'0 2px 20px rgba(0,0,0,.8)'}}>GET YOUR TICKET<br/>TO UNLOCK</div>
            <button onClick={()=>navigate('/')} style={{background:'var(--cream)',border:'none',borderRadius:'10px',padding:'14px 36px',color:'var(--bg)',fontFamily:'DM Sans',fontSize:'13px',fontWeight:600,cursor:'pointer',transition:'all .2s',boxShadow:'0 4px 20px rgba(0,0,0,.4)'}}
              onMouseOver={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(242,230,208,.2)'}}
              onMouseOut={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,.4)'}}>
              Get Ticket
            </button>
          </div>
        )}
        <div onClick={()=>hasTicket?setOpen(true):null} style={{
          filter:!hasTicket?'blur(6px)':'none',
          opacity:!hasTicket?0.35:1,
          pointerEvents:!hasTicket?'none':'auto',
        width:'100%',maxWidth:'360px',
        borderRadius:'20px',overflow:'hidden',
        background:'var(--bg-card)',
        border:'1px solid var(--border-hi)',
        cursor:'pointer',transition:'all .3s',
        boxShadow:'0 8px 40px rgba(0,0,0,.4)',
      }}
        onMouseOver={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='0 16px 50px rgba(0,0,0,.5)';e.currentTarget.style.borderColor='rgba(242,230,208,.15)'}}
        onMouseOut={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 8px 40px rgba(0,0,0,.4)';e.currentTarget.style.borderColor='var(--border-hi)'}}>
        
        {/* Ticket top */}
        <div style={{padding:'32px 28px 24px',textAlign:'center'}}>
          <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.2em',marginBottom:'12px'}}>THE COLLECTIV4 PRESENTS</div>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'center',gap:'8px'}}>
            <span style={{fontFamily:'Bebas Neue',fontSize:'42px',lineHeight:.85,color:'transparent',WebkitTextStroke:'1.5px var(--cream)'}}>RAN</span>
            <span style={{fontFamily:'Bebas Neue',fontSize:'18px',color:'var(--cream)'}}>BY</span>
          </div>
          <div style={{fontFamily:'Bebas Neue',fontSize:'42px',lineHeight:.85,color:'var(--cream)',marginTop:'2px'}}>ARTISTS</div>
          <div style={{fontFamily:'Bebas Neue',fontSize:'32px',color:'#D06020',marginTop:'4px'}}>002</div>
        </div>

        {/* Dashed line */}
        <div style={{margin:'0 20px',borderTop:'1px dashed var(--border-hi)'}} />

        {/* Event info */}
        <div style={{padding:'20px 28px',display:'flex',justifyContent:'space-around'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:'Bebas Neue',fontSize:'20px',color:'var(--cream)'}}>MAY 30</div>
            <div style={{fontFamily:'DM Mono',fontSize:'8px',color:'var(--cream-low)',letterSpacing:'.1em'}}>DATE</div>
          </div>
          <div style={{width:'1px',background:'var(--border-hi)'}} />
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:'Bebas Neue',fontSize:'20px',color:'var(--cream)'}}>10PM</div>
            <div style={{fontFamily:'DM Mono',fontSize:'8px',color:'var(--cream-low)',letterSpacing:'.1em'}}>DOORS</div>
          </div>
          <div style={{width:'1px',background:'var(--border-hi)'}} />
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:'Bebas Neue',fontSize:'20px',color:'var(--cream)'}}>HTX</div>
            <div style={{fontFamily:'DM Mono',fontSize:'8px',color:'var(--cream-low)',letterSpacing:'.1em'}}>CITY</div>
          </div>
        </div>

        {/* Dashed line */}
        <div style={{margin:'0 20px',borderTop:'1px dashed var(--border-hi)'}} />

        {/* Footer */}
        <div style={{padding:'16px 28px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <Users size={12} style={{color:'var(--cream-low)'}} />
            <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)'}}>{attendees.length} going</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <MessageCircle size={12} style={{color:'var(--cream-low)'}} />
            <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)'}}>{messages.length} messages</span>
          </div>
        </div>

        {/* Tap hint */}
        <div style={{padding:'12px',background:hasTicket?'rgba(242,230,208,.03)':'rgba(242,230,208,.02)',borderTop:'1px solid var(--border)',textAlign:'center'}}>
          <span style={{fontFamily:'DM Mono',fontSize:'9px',color:hasTicket?'var(--cream-low)':'var(--cream-ghost)',letterSpacing:'.08em'}}>{hasTicket?'TAP TO ENTER':'GET YOUR TICKET TO UNLOCK'}</span>
        </div>
      </div>
    </div>
  )

  // OPEN STATE — Going + Chat
  return (
    <div style={{background:'linear-gradient(180deg,#0E0D0C 0%,#0C0B0A 20%,#0A0908 40%,#0A0908 100%)',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      
      {/* Header with back to ticket */}
      <div style={{padding:'16px 28px',display:'flex',alignItems:'center',gap:'12px',borderBottom:'1px solid var(--border)'}}>
        <button onClick={()=>setOpen(false)} style={{background:'none',border:'none',color:'var(--cream)',cursor:'pointer',display:'flex',alignItems:'center'}}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{flex:1}}>
          <div style={{fontFamily:'Bebas Neue',fontSize:'16px',color:'var(--cream)',letterSpacing:'.02em'}}>RAN BY ARTISTS 002</div>
          <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.06em'}}>MAY 30 · HOUSTON</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
          <div style={{width:'5px',height:'5px',borderRadius:'50%',background:'#00D54B'}} />
          <span style={{fontFamily:'DM Mono',fontSize:'9px',color:'#00D54B'}}>{attendees.length}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{padding:'12px 28px 0',display:'flex',gap:'4px'}}>
        {[['going','Going',Users,attendees.length],['chat','Chat',MessageCircle,messages.length]].map(([id,label,Icon,count])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
            padding:'10px',borderRadius:'10px',border:'none',cursor:'pointer',
            background:tab===id?'rgba(242,230,208,.08)':'transparent',
            color:tab===id?'var(--cream)':'var(--cream-low)',
            fontFamily:'DM Sans',fontSize:'12px',fontWeight:600,transition:'all .2s',
          }}>
            <Icon size={14} strokeWidth={tab===id?2.2:1.4} />
            {label}
            {count>0 && <span style={{fontFamily:'DM Mono',fontSize:'9px',background:tab===id?'rgba(242,230,208,.12)':'rgba(242,230,208,.04)',padding:'2px 6px',borderRadius:'100px'}}>{count}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'going' ? (
        <div style={{padding:'12px 28px 100px',flex:1}}>
          {loading ? (
            <div style={{textAlign:'center',padding:'40px',color:'var(--cream-low)'}}>Loading...</div>
          ) : attendees.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px',border:'1px solid var(--border)',borderRadius:'12px',marginTop:'8px'}}>
              <div style={{fontFamily:'Bebas Neue',fontSize:'20px',color:'var(--cream)',marginBottom:'6px'}}>BE THE FIRST</div>
              <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)'}}>No tickets sold yet</div>
            </div>
          ) : (
            <div>
              {attendees.map((a,i)=>(
                <div key={i} onClick={()=>navigate(getProfileLink(a))} style={{display:'flex',alignItems:'center',gap:'14px',padding:'12px 0',borderBottom:i<attendees.length-1?'1px solid var(--border)':'none',cursor:'pointer',transition:'all .2s'}}
                  onMouseOver={e=>{e.currentTarget.style.paddingLeft='8px';e.currentTarget.style.background='rgba(242,230,208,.02)'}}
                  onMouseOut={e=>{e.currentTarget.style.paddingLeft='0';e.currentTarget.style.background='transparent'}}>
                  <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'var(--bg-raised)',border:'1px solid var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'14px',color:'var(--cream)',flexShrink:0}}>
                    {(a.buyer_name||'?')[0].toUpperCase()}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'13px',fontWeight:500,color:'var(--cream)'}}>{a.buyer_name||'Attendee'}</div>
                  </div>
                  <span style={{fontFamily:'DM Mono',fontSize:'8px',color:'#00D54B',background:'rgba(0,213,75,.06)',border:'1px solid rgba(0,213,75,.15)',padding:'3px 8px',borderRadius:'100px'}}>GOING</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{flex:1,padding:'12px 28px 130px',overflowY:'auto'}}>
            {messages.length === 0 ? (
              <div style={{textAlign:'center',padding:'40px'}}>
                <MessageCircle size={24} strokeWidth={1.2} style={{color:'var(--cream-low)',marginBottom:'12px'}}/>
                <div style={{fontFamily:'Bebas Neue',fontSize:'18px',color:'var(--cream)',marginBottom:'6px'}}>START THE CONVERSATION</div>
                <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)'}}>Be the first to say something</div>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {messages.map((msg,i)=>{
                  const isMe = msg.user_id === user.id
                  return (
                    <div key={msg.id||i} style={{display:'flex',gap:'10px',flexDirection:isMe?'row-reverse':'row'}}>
                      {!isMe&&<div style={{width:'28px',height:'28px',borderRadius:'50%',background:'var(--bg-raised)',border:'1px solid var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'11px',color:'var(--cream)',flexShrink:0,marginTop:'2px'}}>{(msg.sender_name||'?')[0].toUpperCase()}</div>}
                      <div style={{maxWidth:'78%',background:isMe?'rgba(242,230,208,.06)':'var(--bg-card)',border:'1px solid '+(isMe?'rgba(242,230,208,.1)':'var(--border)'),borderRadius:isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',padding:'10px 14px'}}>
                        {!isMe&&<div style={{fontSize:'11px',fontWeight:600,color:'var(--cream)',marginBottom:'3px'}}>{msg.sender_name}</div>}
                        <div style={{fontSize:'13px',color:'var(--cream-mid)',lineHeight:1.5}}>{msg.text}</div>
                        <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'4px',textAlign:isMe?'right':'left'}}>{new Date(msg.created_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef}/>
              </div>
            )}
          </div>
          <div style={{position:'fixed',bottom:'72px',left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'430px',background:'rgba(10,9,8,.95)',backdropFilter:'blur(16px)',borderTop:'1px solid var(--border)',padding:'10px 20px'}}>
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              <input type="text" placeholder="Say something..." value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
                style={{flex:1,background:'var(--bg-card)',border:'1px solid var(--border-hi)',borderRadius:'100px',padding:'12px 18px',color:'var(--cream)',fontFamily:'DM Sans',fontSize:'13px',outline:'none',transition:'border-color .2s'}}
                onFocus={e=>e.currentTarget.style.borderColor='rgba(242,230,208,.25)'}
                onBlur={e=>e.currentTarget.style.borderColor='var(--border-hi)'} />
              <button onClick={send} disabled={!newMsg.trim()} style={{width:'40px',height:'40px',borderRadius:'50%',background:newMsg.trim()?'var(--cream)':'var(--bg-raised)',border:'none',cursor:newMsg.trim()?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}}>
                <Send size={14} style={{color:newMsg.trim()?'var(--bg)':'var(--cream-low)'}}/>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
