import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { X } from 'lucide-react'

export default function AuthModal({ onClose }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = async () => {
    setLoading(true); setError('')
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
      onClose()
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const inp = {width:'100%',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:'10px',padding:'14px 16px',color:'var(--cream)',fontFamily:'DM Sans',fontSize:'14px',outline:'none',transition:'border-color .2s'}

  return (
    <div style={{position:'fixed',inset:0,zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:'28px'}} onClick={onClose}>
      {/* Backdrop blur */}
      <div style={{position:'absolute',inset:0,background:'rgba(10,9,8,.7)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} />
      
      {/* Modal */}
      <div onClick={e=>e.stopPropagation()} style={{position:'relative',width:'100%',maxWidth:'360px',background:'var(--bg-card)',border:'1px solid var(--border-hi)',borderRadius:'20px',padding:'32px 28px',animation:'fadeUp .3s ease'}}>
        {/* Close button */}
        <button onClick={onClose} style={{position:'absolute',top:'16px',right:'16px',background:'none',border:'none',color:'var(--cream-low)',cursor:'pointer',padding:'4px'}}>
          <X size={18} />
        </button>

        <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',textAlign:'center',marginBottom:'4px'}}>
          {mode==='signin'?'WELCOME BACK':'JOIN THE COMMUNITY'}
        </div>
        <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',textAlign:'center',letterSpacing:'.06em',marginBottom:'24px'}}>
          {mode==='signin'?'Sign in to continue':'Create your account'}
        </div>

        {/* Toggle */}
        <div style={{display:'flex',gap:'4px',marginBottom:'20px',background:'var(--bg-raised)',borderRadius:'10px',padding:'3px'}}>
          {['signin','signup'].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setError('')}} style={{flex:1,background:mode===m?'rgba(242,230,208,.08)':'transparent',border:'none',borderRadius:'8px',padding:'8px',color:mode===m?'var(--cream)':'var(--cream-low)',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'DM Sans',transition:'all .2s'}}>
              {m==='signin'?'Sign In':'Create Account'}
            </button>
          ))}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {mode==='signup' && (
            <input type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={inp}
              onFocus={e=>e.currentTarget.style.borderColor='rgba(242,230,208,.3)'}
              onBlur={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.1)'} />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={inp}
            onFocus={e=>e.currentTarget.style.borderColor='rgba(242,230,208,.3)'}
            onBlur={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.1)'} />
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={inp}
            onKeyDown={e=>e.key==='Enter'&&handle()}
            onFocus={e=>e.currentTarget.style.borderColor='rgba(242,230,208,.3)'}
            onBlur={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.1)'} />
        </div>

        {error && <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'#EF4444',marginTop:'10px',textAlign:'center'}}>{error}</div>}

        <button onClick={handle} disabled={loading} style={{width:'100%',background:'var(--cream)',border:'none',borderRadius:'10px',padding:'14px',color:'var(--bg)',fontWeight:600,fontSize:'13px',cursor:'pointer',fontFamily:'DM Sans',marginTop:'16px',opacity:loading?.6:1,transition:'all .2s'}}
          onMouseOver={e=>{if(!loading){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(242,230,208,.15)'}}}
          onMouseOut={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}>
          {loading?'...':mode==='signin'?'Sign In':'Create Account'}
        </button>
      </div>
    </div>
  )
}
