import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { Lock, Send, MessageCircle, Users, ChevronDown } from 'lucide-react'

export default function Community() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('going')
  const [attendees, setAttendees] = useState([])
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    // Load attendees
    supabase.from('tickets').select('*').eq('status','confirmed').order('created_at',{ascending:false})
      .then(({data}) => { setAttendees(data||[]); setLoading(false) })
      .catch(() => setLoading(false))

    // Load chat messages
    supabase.from('chat_messages').select('*').order('created_at',{ascending:true}).limit(100)
      .then(({data}) => setMessages(data||[]))
      .catch(() => {})

    // Realtime chat
    const channel = supabase.channel('community-chat').on('postgres_changes',
      { event:'INSERT', schema:'public', table:'chat_messages' },
      (payload) => setMessages(prev => [...prev, payload.new])
    ).subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => { if(tab==='chat') bottomRef.current?.scrollIntoView({behavior:'smooth'}) }, [messages, tab])

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
      <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em',marginBottom:'8px'}}>JOIN THE COMMUNITY</div>
      <div style={{fontSize:'13px',color:'var(--cream-mid)',marginBottom:'28px',lineHeight:1.6}}>Create an account to see who's going and chat with other attendees.</div>
      <button onClick={()=>navigate('/auth')} style={{background:'var(--cream)',border:'none',borderRadius:'10px',padding:'14px 36px',color:'var(--bg)',fontFamily:'DM Sans',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Join</button>
    </div>
  )

  return (
    <div style={{background:'linear-gradient(180deg,#0E0D0C 0%,#0C0B0A 20%,#0A0908 40%,#0A0908 100%)',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      {/* Event card header */}
      <div style={{padding:'20px 28px 0'}}>
        <div onClick={()=>navigate('/')} style={{padding:'16px',borderRadius:'12px',background:'var(--bg-card)',border:'1px solid var(--border-hi)',cursor:'pointer',display:'flex',alignItems:'center',gap:'14px',transition:'all .2s'}}
          onMouseOver={e=>e.currentTarget.style.borderColor='rgba(242,230,208,.2)'}
          onMouseOut={e=>e.currentTarget.style.borderColor='var(--border-hi)'}>
          <div style={{width:'44px',height:'44px',borderRadius:'10px',background:'rgba(208,96,32,.08)',border:'1px solid rgba(208,96,32,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'16px',color:'#D06020',flexShrink:0}}>002</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Bebas Neue',fontSize:'18px',color:'var(--cream)',letterSpacing:'.02em'}}>RAN BY ARTISTS</div>
            <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.06em',marginTop:'2px'}}>MAY 30 · 10PM · HOUSTON</div>
          </div>
          <ChevronDown size={16} style={{color:'var(--cream-low)',transform:'rotate(-90deg)'}} />
        </div>
      </div>

      {/* Tabs: Going / Chat */}
      <div style={{padding:'16px 28px 0',display:'flex',gap:'4px'}}>
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
        <div style={{padding:'16px 28px 100px',flex:1}}>
          {loading ? (
            <div style={{textAlign:'center',padding:'40px',color:'var(--cream-low)',fontSize:'13px'}}>Loading...</div>
          ) : attendees.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px',border:'1px solid var(--border)',borderRadius:'12px',marginTop:'8px'}}>
              <div style={{fontFamily:'Bebas Neue',fontSize:'20px',color:'var(--cream)',marginBottom:'6px'}}>BE THE FIRST</div>
              <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)'}}>No tickets sold yet</div>
            </div>
          ) : (
            <div>
              <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.15em',marginBottom:'12px',marginTop:'8px'}}>{attendees.length} CONFIRMED</div>
              {attendees.map((a,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:'14px',padding:'14px 0',borderBottom:i<attendees.length-1?'1px solid var(--border)':'none'}}>
                  <div style={{width:'38px',height:'38px',borderRadius:'50%',background:'var(--bg-raised)',border:'1px solid var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'15px',color:'var(--cream)',flexShrink:0}}>
                    {(a.buyer_email||'?')[0].toUpperCase()}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'14px',fontWeight:500,color:'var(--cream)'}}>{a.buyer_name||a.buyer_email?.split('@')[0]||'Attendee'}</div>
                    <div style={{fontSize:'11px',color:'var(--cream-low)',marginTop:'1px'}}>EARLY BIRD ticket</div>
                  </div>
                  <span style={{fontFamily:'DM Mono',fontSize:'8px',letterSpacing:'.1em',color:'#00D54B',background:'rgba(0,213,75,.06)',border:'1px solid rgba(0,213,75,.15)',padding:'3px 10px',borderRadius:'100px'}}>GOING</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{flex:1,padding:'16px 28px 130px',overflowY:'auto'}}>
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
