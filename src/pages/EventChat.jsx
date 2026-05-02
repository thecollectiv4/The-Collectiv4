import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { Send, Lock, MessageCircle } from 'lucide-react'

export default function EventChat() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}) }, [messages])

  useEffect(() => {
    // Load existing messages
    supabase.from('chat_messages').select('*').order('created_at',{ascending:true}).limit(100)
      .then(({data}) => { setMessages(data||[]); setLoading(false) })
      .catch(() => { setMessages([]); setLoading(false) })

    // Subscribe to realtime
    const channel = supabase.channel('chat').on('postgres_changes',
      { event:'INSERT', schema:'public', table:'chat_messages' },
      (payload) => { setMessages(prev => [...prev, payload.new]) }
    ).subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const send = async () => {
    if (!newMsg.trim() || !user) return
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Attendee'
    const msg = {
      user_id: user.id,
      sender_name: name,
      text: newMsg.trim(),
      created_at: new Date().toISOString(),
    }
    setNewMsg('')
    const { error } = await supabase.from('chat_messages').insert(msg)
    if (error) {
      // If table doesn't exist yet, show locally
      setMessages(prev => [...prev, { ...msg, id: Date.now(), is_local: true }])
    }
  }

  if (!user) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 28px',textAlign:'center',background:'var(--bg)'}}>
      <Lock size={24} strokeWidth={1.2} style={{color:'var(--cream-low)',marginBottom:'20px'}}/>
      <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em',marginBottom:'8px'}}>JOIN THE CONVERSATION</div>
      <div style={{fontSize:'13px',color:'var(--cream-low)',marginBottom:'28px',lineHeight:1.6}}>Get your ticket to chat with other attendees before the event.</div>
      <button onClick={()=>navigate('/auth')} style={{background:'var(--cream)',border:'none',borderRadius:'10px',padding:'14px 36px',color:'var(--bg)',fontFamily:'DM Sans',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Join</button>
    </div>
  )

  return (
    <div style={{background:'linear-gradient(180deg,#0C0C0C 0%,#0A0A0A 30%,#080808 100%)',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'16px 28px',borderBottom:'1px solid var(--border)',background:'rgba(13,10,4,.94)',backdropFilter:'blur(20px)',position:'sticky',top:0,zIndex:10}}>
        <div style={{fontFamily:'Bebas Neue',fontSize:'18px',color:'var(--cream)',letterSpacing:'.02em'}}>RAN BY ARTISTS</div>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'2px',letterSpacing:'.1em'}}>{messages.length} MESSAGES</div>
      </div>
      <div style={{flex:1,padding:'20px 28px 130px',overflowY:'auto'}}>
        <div style={{textAlign:'center',padding:'14px',marginBottom:'20px',fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',border:'1px solid var(--border)',borderRadius:'10px',letterSpacing:'.04em'}}>
          Event group chat · Connect before May 30
        </div>
        {loading ? (
          <div style={{textAlign:'center',padding:'40px',color:'var(--cream-low)',fontSize:'13px'}}>Loading...</div>
        ) : messages.length === 0 ? (
          <div style={{textAlign:'center',padding:'40px'}}>
            <MessageCircle size={24} strokeWidth={1.2} style={{color:'var(--cream-low)',marginBottom:'12px'}}/>
            <div style={{fontFamily:'Bebas Neue',fontSize:'18px',color:'var(--cream)',marginBottom:'6px'}}>START THE CONVERSATION</div>
            <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',letterSpacing:'.04em'}}>Be the first to say something</div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
            {messages.map((msg,i)=>{
              const isMe = msg.user_id === user.id
              return (
                <div key={msg.id||i} style={{display:'flex',gap:'10px',flexDirection:isMe?'row-reverse':'row'}}>
                  {!isMe&&<div style={{width:'28px',height:'28px',borderRadius:'50%',background:'var(--bg-raised)',border:'1px solid var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'12px',color:'var(--gold)',flexShrink:0,marginTop:'2px'}}>{(msg.sender_name||'?')[0].toUpperCase()}</div>}
                  <div style={{maxWidth:'78%',background:isMe?'var(--bg-raised)':'var(--bg-card)',border:'1px solid '+(isMe?'var(--border-hi)':'var(--border)'),borderRadius:isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',padding:'10px 14px'}}>
                    {!isMe&&<div style={{fontSize:'11px',fontWeight:600,color:'var(--gold)',marginBottom:'3px'}}>{msg.sender_name}</div>}
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
      <div style={{position:'fixed',bottom:'64px',left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'430px',background:'rgba(13,10,4,.94)',backdropFilter:'blur(20px)',borderTop:'1px solid var(--border)',padding:'10px 20px'}}>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          <input type="text" placeholder="Say something..." value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
            style={{flex:1,background:'var(--bg-card)',border:'1px solid var(--border-hi)',borderRadius:'100px',padding:'12px 18px',color:'var(--cream)',fontFamily:'DM Sans',fontSize:'13px',outline:'none'}}/>
          <button onClick={send} disabled={!newMsg.trim()} style={{width:'40px',height:'40px',borderRadius:'50%',background:newMsg.trim()?'var(--cream)':'var(--bg-raised)',border:'none',cursor:newMsg.trim()?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',transition:'background .2s'}}>
            <Send size={14} style={{color:newMsg.trim()?'var(--bg)':'var(--cream-low)'}}/>
          </button>
        </div>
      </div>
    </div>
  )
}
