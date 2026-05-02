import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { Send, Lock } from 'lucide-react'

const SEED = [
  { id:1, sender:'Pato',    text:"May 30. The room is going to be different this time.", time:'4:20 PM', color:'var(--rust)'  },
  { id:2, sender:'Marcus',  text:"Edition 1 was insane. Already blocked the date.", time:'4:32 PM',     color:'#4A7A2A'         },
  { id:3, sender:'Jasmine', text:"Are we doing live painting again? I have new pieces ready.", time:'4:45 PM', color:'#7A4A2A' },
  { id:4, sender:'Diego',   text:"Working on something new for the visual experience 👀", time:'5:01 PM', color:'#2A5A7A'       },
  { id:5, sender:'Devon',   text:"House music all night please. That first set was everything.", time:'5:15 PM', color:'#6A2A7A'},
  { id:6, sender:'Sofía',   text:"Fashion pop-up round 2! Who wants a table?", time:'5:28 PM',       color:'#7A2A5A'           },
]

export default function EventChat() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState(SEED)
  const [newMsg, setNewMsg] = useState('')
  const [uName, setUName] = useState('You')
  const bottomRef = useRef(null)
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}) },[messages])
  useEffect(()=>{ if(user) supabase.from('profiles').select('display_name').eq('id',user.id).single().then(({data})=>data&&setUName(data.display_name||'You')).catch(()=>{}) },[user])

  const send = () => {
    if(!newMsg.trim()) return
    setMessages(p=>[...p,{id:Date.now(),sender:uName,text:newMsg.trim(),isMe:true,time:new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}])
    setNewMsg('')
  }

  if (!user) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 28px',textAlign:'center',background:'var(--bg)'}}>
      <Lock size={24} strokeWidth={1.2} style={{color:'var(--cream-low)',marginBottom:'20px'}}/>
      <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em',marginBottom:'8px'}}>JOIN THE CONVERSATION</div>
      <div style={{fontSize:'13px',color:'var(--cream-low)',marginBottom:'28px',lineHeight:1.6}}>Create an account to chat with other attendees before the event.</div>
      <button onClick={()=>navigate('/auth')} style={{background:'var(--cream)',border:'none',borderRadius:'10px',padding:'14px 36px',color:'var(--bg)',fontFamily:'DM Sans',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Join</button>
    </div>
  )

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'16px 28px',borderBottom:'1px solid var(--border)',background:'rgba(13,10,4,.94)',backdropFilter:'blur(20px)',position:'sticky',top:0,zIndex:10}}>
        <div style={{fontFamily:'Bebas Neue',fontSize:'18px',color:'var(--cream)',letterSpacing:'.02em'}}>RAN BY ARTISTS</div>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'2px',letterSpacing:'.1em'}}>{messages.length} MESSAGES · {new Set(messages.map(m=>m.sender)).size} MEMBERS</div>
      </div>
      <div style={{flex:1,padding:'20px 28px 130px',overflowY:'auto'}}>
        <div style={{textAlign:'center',padding:'14px',marginBottom:'20px',fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',border:'1px solid var(--border)',borderRadius:'10px',letterSpacing:'.04em'}}>
          Event group chat · Connect before May 30
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
          {messages.map(msg=>(
            <div key={msg.id} style={{display:'flex',gap:'10px',flexDirection:msg.isMe?'row-reverse':'row'}}>
              {!msg.isMe&&<div style={{width:'28px',height:'28px',borderRadius:'50%',background:'var(--bg-raised)',border:'1px solid var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'12px',color:msg.color||'var(--gold)',flexShrink:0,marginTop:'2px'}}>{msg.sender[0]}</div>}
              <div style={{maxWidth:'78%',background:msg.isMe?'var(--bg-raised)':'var(--bg-card)',border:`1px solid ${msg.isMe?'var(--border-hi)':'var(--border)'}`,borderRadius:msg.isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',padding:'10px 14px'}}>
                {!msg.isMe&&<div style={{fontSize:'11px',fontWeight:600,color:msg.color||'var(--gold)',marginBottom:'3px'}}>{msg.sender}</div>}
                <div style={{fontSize:'13px',color:'var(--cream-mid)',lineHeight:1.5}}>{msg.text}</div>
                <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'4px',textAlign:msg.isMe?'right':'left'}}>{msg.time}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef}/>
        </div>
      </div>
      <div style={{position:'fixed',bottom:'56px',left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'430px',background:'rgba(13,10,4,.94)',backdropFilter:'blur(20px)',borderTop:'1px solid var(--border)',padding:'10px 20px'}}>
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
