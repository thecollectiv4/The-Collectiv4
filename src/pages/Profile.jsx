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
  const [form, setForm] = useState({display_name:'',bio:'',handle:''})
  const [ticket, setTicket] = useState(null)
  const [copied, setCopied] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(()=>{ if(!user){navigate('/auth');return} load() },[user])

  const load = async () => {
    const {data} = await supabase.from('profiles').select('*').eq('id',user.id).single()
    if(data){ setProfile(data); setForm({display_name:data.full_name||'',bio:data.bio||'',handle:data.username||''}) }
    else {
      const nm = user.user_metadata?.full_name || user.email.split('@')[0]
      const np={id:user.id,full_name:nm,username:'',bio:'',city:'Houston',avatar_url:''}
      await supabase.from('profiles').insert(np)
      setProfile(np); setForm({display_name:nm,bio:'',handle:''})
    }
    // Load ticket
    const {data:tk} = await supabase.from('tickets').select('*').eq('buyer_email',user.email).eq('status','confirmed').single()
    if(tk) setTicket(tk)
  }

  const save = async () => { await supabase.from('profiles').update({full_name:form.display_name,username:form.handle,bio:form.bio}).eq('id',user.id); setProfile(p=>({...p,...form})); setEditing(false) }

  const uploadPhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      // Convert to base64 for simplicity (works without storage bucket)
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const url = ev.target.result
        await supabase.from('profiles').update({avatar_url: url}).eq('id',user.id)
        setProfile(p=>({...p, avatar_url: url}))
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch(err) { setUploading(false) }
  }

  const copyQR = () => {
    if(ticket?.qr_code) {
      navigator.clipboard.writeText(ticket.qr_code)
      setCopied(true)
      setTimeout(()=>setCopied(false),2000)
    }
  }

  const inp = {width:'100%',background:'var(--bg-card)',border:'1px solid var(--border-hi)',borderRadius:'10px',padding:'14px 16px',color:'var(--cream)',fontFamily:'DM Sans',fontSize:'14px',outline:'none',transition:'border-color .2s'}

  if(!profile) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}><div style={{fontFamily:'DM Mono',fontSize:'11px',color:'var(--cream-low)'}}>Loading...</div></div>

  return (
    <div style={{background:'linear-gradient(180deg,#0E0D0C 0%,#0C0B0A 20%,#0A0908 40%,#0A0908 100%)',minHeight:'100vh'}}>
      {/* Sign Out */}
      <div style={{padding:'20px 28px 0',display:'flex',justifyContent:'flex-end'}}>
        <button onClick={async()=>{await signOut();navigate('/')}}
          style={{background:'rgba(220,38,38,.06)',border:'1px solid rgba(220,38,38,.2)',borderRadius:'8px',padding:'6px 14px',color:'#EF4444',fontSize:'11px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',fontFamily:'DM Sans',transition:'all .2s'}}
          onMouseOver={e=>{e.currentTarget.style.background='rgba(220,38,38,.15)';e.currentTarget.style.borderColor='rgba(220,38,38,.4)'}}
          onMouseOut={e=>{e.currentTarget.style.background='rgba(220,38,38,.06)';e.currentTarget.style.borderColor='rgba(220,38,38,.2)'}}>
          <LogOut size={11}/> Sign Out
        </button>
      </div>

      {/* Avatar with photo upload */}
      <div style={{padding:'24px 28px 0',display:'flex',justifyContent:'center'}}>
        <div style={{position:'relative',cursor:'pointer'}} onClick={()=>fileRef.current?.click()}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{width:'90px',height:'90px',borderRadius:'50%',objectFit:'cover',border:'2px solid rgba(242,230,208,.2)',boxShadow:'0 0 24px rgba(242,230,208,.08)'}} />
          ) : (
            <div style={{width:'90px',height:'90px',borderRadius:'50%',background:'var(--bg-raised)',border:'2px solid rgba(242,230,208,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'38px',color:'var(--cream)',boxShadow:'0 0 24px rgba(242,230,208,.08)'}}>
              {(profile.display_name||'?')[0].toUpperCase()}
            </div>
          )}
          <div style={{position:'absolute',bottom:'0',right:'0',width:'28px',height:'28px',borderRadius:'50%',background:'var(--bg-card)',border:'1px solid var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}}
            onMouseOver={e=>e.currentTarget.style.borderColor='var(--cream-low)'}
            onMouseOut={e=>e.currentTarget.style.borderColor='var(--border-hi)'}>
            <Camera size={12} style={{color:'var(--cream-mid)'}} />
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={uploadPhoto} />
          {uploading && <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'rgba(10,9,8,.7)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'var(--cream-mid)'}}>...</div>}
        </div>
      </div>

      <div style={{padding:'16px 28px'}}>
        {editing?(
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {[['NAME','Your name','display_name','text'],['HANDLE','@yourhandle','handle','text'],['BIO','What do you do?','bio','textarea']].map(([lbl,ph,key,type])=>(
              <div key={key}>
                <label style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.2em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'6px',display:'block'}}>{lbl}</label>
                {type==='textarea'?(
                  <textarea placeholder={ph} value={form[key]} rows={3} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} style={{...inp,resize:'vertical'}}
                    onFocus={e=>e.currentTarget.style.borderColor='rgba(242,230,208,.3)'} onBlur={e=>e.currentTarget.style.borderColor='var(--border-hi)'}/>
                ):(
                  <input type="text" placeholder={ph} value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} style={inp}
                    onFocus={e=>e.currentTarget.style.borderColor='rgba(242,230,208,.3)'} onBlur={e=>e.currentTarget.style.borderColor='var(--border-hi)'}/>
                )}
              </div>
            ))}
            <button onClick={save} style={{background:'var(--cream)',border:'none',borderRadius:'10px',padding:'14px',color:'var(--bg)',fontWeight:600,fontSize:'13px',cursor:'pointer',fontFamily:'DM Sans',transition:'all .2s'}}
              onMouseOver={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(242,230,208,.15)'}}
              onMouseOut={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}>
              Save
            </button>
          </div>
        ):(
          <>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
              <div>
                <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em'}}>{profile.display_name||'Set your name'}</div>
                {profile.handle&&<div style={{fontFamily:'DM Mono',fontSize:'11px',color:'var(--cream-mid)',marginTop:'2px'}}>@{profile.handle} · Houston</div>}
              </div>
              <button onClick={()=>setEditing(true)} style={{background:'rgba(242,230,208,.04)',border:'1px solid rgba(242,230,208,.12)',borderRadius:'8px',padding:'6px 14px',color:'var(--cream-mid)',fontSize:'11px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',fontFamily:'DM Sans',transition:'all .2s'}}
                onMouseOver={e=>{e.currentTarget.style.background='rgba(242,230,208,.1)';e.currentTarget.style.borderColor='rgba(242,230,208,.25)'}}
                onMouseOut={e=>{e.currentTarget.style.background='rgba(242,230,208,.04)';e.currentTarget.style.borderColor='rgba(242,230,208,.12)'}}>
                <Edit3 size={11}/> Edit
              </button>
            </div>
            {profile.bio&&<div style={{fontSize:'13px',color:'var(--cream-mid)',marginTop:'10px',lineHeight:1.6}}>{profile.bio}</div>}
          </>
        )}
      </div>

      <div style={{height:'1px',background:'linear-gradient(90deg,transparent,rgba(242,230,208,.06),transparent)',margin:'8px 28px'}}/>

      {/* YOUR TICKET with QR */}
      <div style={{padding:'24px 28px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'16px'}}>YOUR TICKET</div>
        {ticket ? (
          <div style={{border:'1px solid var(--border-hi)',borderRadius:'14px',overflow:'hidden'}}>
            <div style={{padding:'24px',background:'var(--bg-card)',textAlign:'center'}}>
              <div style={{fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--cream)',letterSpacing:'.02em',marginBottom:'4px'}}>RAN BY ARTISTS <span style={{color:'#D06020'}}>002</span></div>
              <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.08em',marginBottom:'20px'}}>MAY 30, 2026 · HOUSTON</div>
              
              {/* QR Code */}
              <div style={{display:'inline-block',padding:'16px',background:'#FFFFFF',borderRadius:'12px',marginBottom:'16px'}}>
                <QRCodeSVG value={ticket.qr_code || 'RBA2-TICKET'} size={140} level="H" />
              </div>
              
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginBottom:'8px'}}>
                <span style={{fontFamily:'DM Mono',fontSize:'12px',color:'var(--cream)',letterSpacing:'.04em',fontWeight:600}}>{ticket.qr_code}</span>
                <button onClick={copyQR} style={{background:'none',border:'none',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center'}}>
                  {copied ? <Check size={14} style={{color:'#00D54B'}} /> : <Copy size={14} style={{color:'var(--cream-low)'}} />}
                </button>
              </div>
              <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.06em'}}>{'EARLY BIRD'} · ${(ticket.price_paid||0).toFixed(0)} PAID</div>
            </div>
            <div style={{padding:'14px 24px',borderTop:'1px dashed var(--border-hi)',background:'rgba(0,213,75,.03)',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
              <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#00D54B',boxShadow:'0 0 6px rgba(0,213,75,.4)'}} />
              <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'#00D54B',letterSpacing:'.06em',fontWeight:600}}>CONFIRMED</span>
            </div>
          </div>
        ) : (
          <div style={{border:'1px solid var(--border-hi)',borderRadius:'14px',overflow:'hidden',cursor:'pointer',transition:'all .3s'}}
            onClick={()=>navigate('/')}
            onMouseOver={e=>{e.currentTarget.style.borderColor='rgba(242,230,208,.2)';e.currentTarget.style.transform='translateY(-2px)'}}
            onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border-hi)';e.currentTarget.style.transform='translateY(0)'}}>
            <div style={{padding:'24px',background:'var(--bg-card)'}}>
              <div style={{fontFamily:'Bebas Neue',fontSize:'24px',color:'var(--cream)',letterSpacing:'.02em'}}>RAN BY ARTISTS <span style={{color:'#D06020'}}>002</span></div>
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
              <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',letterSpacing:'.06em'}}>Get your ticket · from $15</span>
              <ChevronRight size={14} style={{color:'var(--cream-low)'}} />
            </div>
          </div>
        )}
      </div>

      {/* Past editions */}
      <div style={{padding:'0 28px 100px'}}>
        <div style={{border:'1px solid var(--border)',borderRadius:'12px',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',transition:'all .2s'}}
          onClick={()=>navigate('/editions')}
          onMouseOver={e=>{e.currentTarget.style.borderColor='rgba(255,215,0,.2)';e.currentTarget.style.background='rgba(255,215,0,.03)'}}
          onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='transparent'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <Sparkles size={14} style={{color:'#FFD700'}} />
            <div>
              <div style={{fontSize:'12px',fontWeight:600,color:'var(--cream)'}}>Past Editions</div>
              <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'2px'}}>1 event attended</div>
            </div>
          </div>
          <ChevronRight size={14} style={{color:'var(--cream-low)'}} />
        </div>
      </div>
    </div>
  )
}
