import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { LogOut, Edit3, Calendar, MapPin, Clock, ChevronRight, Sparkles, Camera, Copy, Check } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

export default function Profile() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [ticket, setTicket] = useState(null)
  const [copied, setCopied] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const fileRef = useRef(null)

  useEffect(()=>{ if(!user){navigate('/auth');return} load() },[user])

  const load = async () => {
    // Try to find profile by user_id first, then by id
    let {data} = await supabase.from('profiles').select('*').eq('id',user.id).single()
    if(!data) {
      // Try creating a new profile
      const nm = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
      const {data:newP, error} = await supabase.from('profiles').insert({
        id: user.id, full_name: nm, username: '', bio: '', city: 'Houston'
      }).select().single()
      if(newP) data = newP
      else {
        // If insert fails (maybe id conflict), just use metadata
        data = { full_name: nm, username: '', bio: '', avatar_url: '' }
      }
      setEditing(true)
    }
    setProfile(data)
    setName(data.full_name || '')
    setUsername(data.username || '')
    setBio(data.bio || '')
    setAvatarUrl(data.avatar_url || '')

    // Load ticket
    const email = user.email
    if(email) {
      const {data:tk} = await supabase.from('tickets').select('*').eq('buyer_email',email).eq('status','confirmed').maybeSingle()
      if(tk) setTicket(tk)
    }
  }

  const save = async () => {
    await supabase.from('profiles').update({full_name:name,username,bio}).eq('id',user.id)
    setProfile(p=>({...p,full_name:name,username,bio}))
    setEditing(false)
  }

  const uploadPhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const url = ev.target.result
      await supabase.from('profiles').update({avatar_url:url}).eq('id',user.id)
      setAvatarUrl(url)
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const inp = {width:'100%',background:'var(--bg-card)',border:'1px solid var(--border-hi)',borderRadius:'10px',padding:'14px 16px',color:'var(--cream)',fontFamily:'DM Sans',fontSize:'14px',outline:'none',transition:'border-color .2s'}

  if(!profile) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}><div style={{fontFamily:'DM Mono',fontSize:'11px',color:'var(--cream-low)'}}>Loading...</div></div>

  return (
    <div style={{background:'linear-gradient(180deg,#0E0D0C 0%,#0C0B0A 20%,#0A0908 40%,#0A0908 100%)',minHeight:'100vh'}}>
      {/* Sign Out */}
      <div style={{padding:'20px 28px 0',display:'flex',justifyContent:'flex-end'}}>
        <button onClick={async()=>{await signOut();navigate('/')}}
          style={{background:'rgba(220,38,38,.06)',border:'1px solid rgba(220,38,38,.2)',borderRadius:'8px',padding:'6px 14px',color:'#EF4444',fontSize:'11px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',fontFamily:'DM Sans',transition:'all .2s'}}
          onMouseOver={e=>{e.currentTarget.style.background='rgba(220,38,38,.15)'}}
          onMouseOut={e=>{e.currentTarget.style.background='rgba(220,38,38,.06)'}}>
          <LogOut size={11}/> Sign Out
        </button>
      </div>

      {/* Avatar */}
      <div style={{padding:'24px 28px 0',display:'flex',justifyContent:'center'}}>
        <div style={{position:'relative',cursor:'pointer'}} onClick={()=>fileRef.current?.click()}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{width:'90px',height:'90px',borderRadius:'50%',objectFit:'cover',border:'2px solid rgba(242,230,208,.2)'}} />
          ) : (
            <div style={{width:'90px',height:'90px',borderRadius:'50%',background:'var(--bg-raised)',border:'2px solid rgba(242,230,208,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'38px',color:'var(--cream)'}}>
              {(name||user.email||'?')[0].toUpperCase()}
            </div>
          )}
          <div style={{position:'absolute',bottom:'0',right:'0',width:'28px',height:'28px',borderRadius:'50%',background:'var(--bg-card)',border:'1px solid var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Camera size={12} style={{color:'var(--cream-mid)'}} />
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={uploadPhoto} />
          {uploading && <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'rgba(10,9,8,.7)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'var(--cream-mid)'}}>...</div>}
        </div>
      </div>

      {/* Name & Edit */}
      <div style={{padding:'16px 28px'}}>
        {editing ? (
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            <div>
              <label style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.2em',color:'var(--cream-low)',marginBottom:'6px',display:'block'}}>NAME</label>
              <input type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={inp}
                onFocus={e=>e.currentTarget.style.borderColor='rgba(242,230,208,.3)'} onBlur={e=>e.currentTarget.style.borderColor='var(--border-hi)'} />
            </div>
            <div>
              <label style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.2em',color:'var(--cream-low)',marginBottom:'6px',display:'block'}}>HANDLE</label>
              <input type="text" placeholder="@yourhandle" value={username} onChange={e=>setUsername(e.target.value)} style={inp}
                onFocus={e=>e.currentTarget.style.borderColor='rgba(242,230,208,.3)'} onBlur={e=>e.currentTarget.style.borderColor='var(--border-hi)'} />
            </div>
            <div>
              <label style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.2em',color:'var(--cream-low)',marginBottom:'6px',display:'block'}}>BIO</label>
              <textarea placeholder="What do you do?" value={bio} rows={3} onChange={e=>setBio(e.target.value)} style={{...inp,resize:'vertical'}}
                onFocus={e=>e.currentTarget.style.borderColor='rgba(242,230,208,.3)'} onBlur={e=>e.currentTarget.style.borderColor='var(--border-hi)'} />
            </div>
            <button onClick={save} style={{background:'var(--cream)',border:'none',borderRadius:'10px',padding:'14px',color:'var(--bg)',fontWeight:600,fontSize:'13px',cursor:'pointer',fontFamily:'DM Sans',transition:'all .2s'}}
              onMouseOver={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(242,230,208,.15)'}}
              onMouseOut={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}>Save</button>
          </div>
        ) : (
          <>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
              <div>
                <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em'}}>{name||'Set your name'}</div>
                {username&&<div style={{fontFamily:'DM Mono',fontSize:'11px',color:'var(--cream-mid)',marginTop:'2px'}}>@{username} · Houston</div>}
              </div>
              <button onClick={()=>setEditing(true)} style={{background:'rgba(242,230,208,.04)',border:'1px solid rgba(242,230,208,.12)',borderRadius:'8px',padding:'6px 14px',color:'var(--cream-mid)',fontSize:'11px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',fontFamily:'DM Sans',transition:'all .2s'}}
                onMouseOver={e=>e.currentTarget.style.background='rgba(242,230,208,.1)'}
                onMouseOut={e=>e.currentTarget.style.background='rgba(242,230,208,.04)'}>
                <Edit3 size={11}/> Edit
              </button>
            </div>
            {bio&&<div style={{fontSize:'13px',color:'var(--cream-mid)',marginTop:'10px',lineHeight:1.6}}>{bio}</div>}
          </>
        )}
      </div>

      <div style={{height:'1px',background:'linear-gradient(90deg,transparent,rgba(242,230,208,.06),transparent)',margin:'8px 28px'}}/>

      {/* TICKET */}
      <div style={{padding:'24px 28px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'16px'}}>YOUR TICKET</div>
        {ticket ? (
          <div style={{border:'1px solid var(--border-hi)',borderRadius:'14px',overflow:'hidden'}}>
            <div style={{padding:'24px',background:'var(--bg-card)',textAlign:'center'}}>
              <div style={{fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--cream)',marginBottom:'4px'}}>RAN BY ARTISTS <span style={{color:'#D06020'}}>002</span></div>
              <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.08em',marginBottom:'20px'}}>MAY 30, 2026 · HOUSTON</div>
              <div style={{display:'inline-block',padding:'16px',background:'#FFFFFF',borderRadius:'12px',marginBottom:'16px'}}>
                <QRCodeSVG value={ticket.qr_code||'RBA2-TICKET'} size={140} level="H" />
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginBottom:'8px'}}>
                <span style={{fontFamily:'DM Mono',fontSize:'12px',color:'var(--cream)',letterSpacing:'.04em',fontWeight:600}}>{ticket.qr_code}</span>
                <button onClick={()=>{navigator.clipboard.writeText(ticket.qr_code);setCopied(true);setTimeout(()=>setCopied(false),2000)}} style={{background:'none',border:'none',cursor:'pointer',padding:'4px'}}>
                  {copied ? <Check size={14} style={{color:'#00D54B'}} /> : <Copy size={14} style={{color:'var(--cream-low)'}} />}
                </button>
              </div>
              <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.06em'}}>EARLY BIRD · ${ticket.price_paid||0} PAID</div>
            </div>
            <div style={{padding:'14px 24px',borderTop:'1px dashed var(--border-hi)',background:'rgba(0,213,75,.03)',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
              <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#00D54B',boxShadow:'0 0 6px rgba(0,213,75,.4)'}} />
              <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'#00D54B',letterSpacing:'.06em',fontWeight:600}}>CONFIRMED</span>
            </div>
          </div>
        ) : (
          <div style={{border:'1px solid var(--border-hi)',borderRadius:'14px',overflow:'hidden',cursor:'pointer',transition:'all .3s'}}
            onClick={()=>navigate('/')}
            onMouseOver={e=>e.currentTarget.style.borderColor='rgba(242,230,208,.2)'}
            onMouseOut={e=>e.currentTarget.style.borderColor='var(--border-hi)'}>
            <div style={{padding:'24px',background:'var(--bg-card)'}}>
              <div style={{fontFamily:'Bebas Neue',fontSize:'24px',color:'var(--cream)'}}>RAN BY ARTISTS <span style={{color:'#D06020'}}>002</span></div>
              <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',marginTop:'4px',letterSpacing:'.08em'}}>MAY EDITION</div>
              <div style={{display:'flex',gap:'20px',marginTop:'20px'}}>
                {[[Calendar,'MAY 30'],[Clock,'10PM'],[MapPin,'HTX']].map(([Icon,text],i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                    <Icon size={11} strokeWidth={1.2} style={{color:'var(--cream)'}}/>
                    <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',letterSpacing:'.06em'}}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:'14px 24px',borderTop:'1px dashed var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)'}}>Get your ticket · from $15</span>
              <ChevronRight size={14} style={{color:'var(--cream-low)'}} />
            </div>
          </div>
        )}
      </div>

      {/* Events Attended */}
      <div style={{padding:'0 28px 100px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'16px'}}>EVENTS ATTENDED</div>
        <div style={{border:'1px solid var(--border)',borderRadius:'12px',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',transition:'all .2s'}}
          onClick={()=>navigate('/editions')}
          onMouseOver={e=>{e.currentTarget.style.borderColor='rgba(255,215,0,.2)';e.currentTarget.style.background='rgba(255,215,0,.03)'}}
          onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='transparent'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <div style={{
              display:'flex',alignItems:'center',gap:'4px',
              background:'linear-gradient(135deg,rgba(255,215,0,.15),rgba(255,255,255,.08))',
              border:'1px solid rgba(255,215,0,.3)',borderRadius:'8px',padding:'6px 10px',
              boxShadow:'0 0 12px rgba(255,215,0,.08)',
            }}>
              <Sparkles size={12} style={{color:'#FFD700'}} />
              <span style={{fontFamily:'Bebas Neue',fontSize:'16px',color:'#FFD700'}}>1</span>
            </div>
            <div>
              <div style={{fontSize:'13px',fontWeight:600,color:'var(--cream)'}}>Edition 001 — Sanman Studios</div>
              <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'2px'}}>April 4, 2026</div>
            </div>
          </div>
          <ChevronRight size={14} style={{color:'var(--cream-low)'}} />
        </div>
      </div>
    </div>
  )
}
