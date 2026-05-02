import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { LogOut, Edit3, Calendar, MapPin, Clock } from 'lucide-react'

export default function Profile() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({display_name:'',bio:'',handle:''})

  useEffect(()=>{ if(!user){navigate('/auth');return} load() },[user])

  const load = async () => {
    const {data} = await supabase.from('profiles').select('*').eq('id',user.id).single()
    if(data){ setProfile(data); setForm({display_name:data.display_name||'',bio:data.bio||'',handle:data.handle||''}) }
    else {
      const np={id:user.id,display_name:user.email.split('@')[0],bio:'',handle:'',city:'Houston'}
      await supabase.from('profiles').insert(np)
      setProfile(np); setForm({display_name:np.display_name,bio:'',handle:''}); setEditing(true)
    }
  }
  const save = async () => { await supabase.from('profiles').update(form).eq('id',user.id); setProfile(p=>({...p,...form})); setEditing(false) }
  const inp = {width:'100%',background:'var(--bg-card)',border:'1px solid var(--border-hi)',borderRadius:'10px',padding:'14px 16px',color:'var(--cream)',fontFamily:'DM Sans',fontSize:'14px',outline:'none'}

  if(!profile) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}><div style={{fontFamily:'DM Mono',fontSize:'11px',color:'var(--cream-low)'}}>Loading...</div></div>

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh'}}>
      {/* Header matching Event page */}
      <div style={{position:'sticky',top:0,zIndex:50,background:'rgba(13,10,4,.92)',backdropFilter:'blur(16px)',borderBottom:'1px solid var(--border-hi)',padding:'12px 28px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontFamily:'Bebas Neue',fontSize:'16px',color:'var(--cream)',letterSpacing:'.06em'}}>PROFILE</div>
        <button onClick={async()=>{await signOut();navigate('/')}} style={{background:'none',border:'1px solid rgba(255,255,255,.12)',borderRadius:'8px',padding:'6px 14px',color:'var(--cream-mid)',fontSize:'11px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',fontFamily:'DM Sans'}}>
          <LogOut size={11}/> Sign Out
        </button>
      </div>
      {/* Hero gradient */}
      <div style={{height:'100px',background:'linear-gradient(160deg,#1C1810,#141008,#0D0A04)',position:'relative',overflow:'visible'}}>
        <div style={{position:'absolute',top:'-20px',right:'-20px',width:'160px',height:'160px',borderRadius:'50%',background:'radial-gradient(circle,rgba(255,255,255,.04) 0%,transparent 70%)',filter:'blur(40px)'}} />
      </div>
      <div style={{padding:'0 28px',marginTop:'-40px',position:'relative',zIndex:3}}>
        <div style={{width:'80px',height:'80px',borderRadius:'50%',background:'var(--bg-raised)',border:'3px solid var(--bg)',outline:'2px solid rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'34px',color:'var(--cream)',boxShadow:'0 4px 20px rgba(0,0,0,.4)'}}>
          {(profile.display_name||'?')[0].toUpperCase()}
        </div>
      </div>
      <div style={{padding:'16px 28px'}}>
        {editing?(
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {[['NAME','Your name','display_name','text'],['HANDLE','@yourhandle','handle','text'],['BIO','What do you do?','bio','textarea']].map(([lbl,ph,key,type])=>(
              <div key={key}>
                <label style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.2em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'6px',display:'block'}}>{lbl}</label>
                {type==='textarea'?(
                  <textarea placeholder={ph} value={form[key]} rows={3} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} style={{...inp,resize:'vertical'}}/>
                ):(
                  <input type="text" placeholder={ph} value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} style={inp}/>
                )}
              </div>
            ))}
            <button onClick={save} style={{background:'var(--cream)',border:'none',borderRadius:'10px',padding:'14px',color:'var(--bg)',fontWeight:600,fontSize:'13px',cursor:'pointer',fontFamily:'DM Sans'}}>Save</button>
          </div>
        ):(
          <>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
              <div>
                <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em'}}>{profile.display_name||'Set your name'}</div>
                {profile.handle&&<div style={{fontFamily:'DM Mono',fontSize:'11px',color:'var(--cream-mid)',marginTop:'2px'}}>@{profile.handle} · Houston</div>}
              </div>
              <button onClick={()=>setEditing(true)} style={{background:'none',border:'1px solid var(--border-hi)',borderRadius:'8px',padding:'6px 14px',color:'var(--cream-low)',fontSize:'11px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',fontFamily:'DM Sans'}}>
                <Edit3 size={11}/> Edit
              </button>
            </div>
            {profile.bio&&<div style={{fontSize:'13px',color:'var(--cream-mid)',marginTop:'10px',lineHeight:1.6}}>{profile.bio}</div>}
          </>
        )}
      </div>
      <div style={{height:'1px',background:'var(--border)',margin:'8px 28px'}}/>
      <div style={{padding:'24px 28px 100px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'16px'}}>YOUR TICKET</div>
        <div style={{border:'1px solid var(--border-hi)',borderRadius:'12px',overflow:'hidden'}}>
          <div style={{padding:'24px',background:'var(--bg-card)'}}>
            <div style={{fontFamily:'Bebas Neue',fontSize:'24px',color:'var(--cream)',letterSpacing:'.02em'}}>RAN BY ARTISTS <span style={{color:'var(--gold)'}}>002</span></div>
            <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',marginTop:'4px',letterSpacing:'.08em'}}>MAY EDITION</div>
            <div style={{display:'flex',gap:'20px',marginTop:'20px'}}>
              {[[Calendar,'MAY 30'],[Clock,'10PM'],[MapPin,'HTX']].map(([Icon,text],i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                  <Icon size={11} strokeWidth={1.2} style={{color:'var(--cream-low)'}}/>
                  <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',letterSpacing:'.06em'}}>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{padding:'16px 24px',borderTop:'1px dashed var(--border)',textAlign:'center'}}>
            <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',letterSpacing:'.06em'}}>Tickets go live May 15 · Early bird $15</div>
          </div>
        </div>
      </div>
    </div>
  )
}
