import { useState } from 'react'
import { supabase } from '@/api/supabase'
import { humanizeAuthError } from '@/lib/authErrors'
import { X } from 'lucide-react'

// signinTitle / signinKicker override the sign-in greeting for a first-touch
// context (e.g. the For You door): a first-time visitor must never be greeted
// with "WELCOME BACK". Signup copy is unchanged. Defaults keep every other call.
export default function AuthModal({ onClose, signinTitle = 'WELCOME BACK', signinKicker = 'Sign in to continue' }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const handle = async () => {
    if (mode === 'signup' && (!firstName.trim() || !lastName.trim())) { setError('Escribe tu nombre y apellido'); return }
    setLoading(true); setError(''); setNotice('')
    try {
      if (mode === 'signup') {
        const fullName = `${firstName.trim()} ${lastName.trim()}`
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, first_name: firstName.trim(), last_name: lastName.trim() } } })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
      // Just dismiss — the user stays on the page they were on. Members reach the
      // OS deliberately via its own server-gated nav entry, never an auto-redirect.
      onClose()
    } catch (e) { setError(humanizeAuthError(e)) }
    setLoading(false)
  }

  // D3: forgot password — anti-enumeration (same confirmation either way).
  const forgot = async () => {
    if (!email.trim()) { setError('Escribe tu correo para mandarte el enlace'); return }
    setLoading(true); setError(''); setNotice('')
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })
      setNotice('Si hay una cuenta con ese correo, te mandamos un enlace.')
    } catch (e) { setError(humanizeAuthError(e)) }
    setLoading(false)
  }

  const inp = {width:'100%',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:'10px',padding:'14px 16px',color:'var(--cream)',fontFamily:'DM Sans',fontSize:'14px',outline:'none',transition:'border-color .2s'}

  return (
    <div style={{position:'fixed',inset:0,zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:'28px'}} onClick={onClose}>
      {/* Backdrop blur */}
      <div style={{position:'absolute',inset:0,background:'rgba(10,10,13,.7)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} />
      
      {/* Modal */}
      <div onClick={e=>e.stopPropagation()} style={{position:'relative',width:'100%',maxWidth:'360px',background:'var(--bg-card)',border:'1px solid var(--border-hi)',borderRadius:'20px',padding:'32px 28px',animation:'fadeUp .3s ease'}}>
        {/* Close button */}
        <button onClick={onClose} aria-label="Close" className="pressable" style={{position:'absolute',top:'16px',right:'16px',background:'none',border:'none',color:'var(--cream-low)',cursor:'pointer',padding:'4px'}}>
          <X size={18} />
        </button>

        <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',textAlign:'center',marginBottom:'4px'}}>
          {mode==='signin'?signinTitle:'JOIN THE COMMUNITY'}
        </div>
        <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',textAlign:'center',letterSpacing:'.06em',marginBottom:'24px'}}>
          {mode==='signin'?signinKicker:'Create your account'}
        </div>

        {/* Toggle */}
        <div style={{display:'flex',gap:'4px',marginBottom:'20px',background:'var(--bg-raised)',borderRadius:'10px',padding:'3px'}}>
          {['signin','signup'].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setError('');setNotice('')}} className="pressable" style={{flex:1,background:mode===m?'rgba(242,238,230,.08)':'transparent',border:'none',borderRadius:'8px',padding:'8px',color:mode===m?'var(--cream)':'var(--cream-low)',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'DM Sans',transition:'background .2s, color .2s'}}>
              {m==='signin'?'Sign In':'Create Account'}
            </button>
          ))}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {mode==='signup' && (
            <div style={{display:'flex',gap:'8px'}}>
              <input type="text" placeholder="First name" value={firstName} onChange={e=>setFirstName(e.target.value)} style={inp}
                onFocus={e=>e.currentTarget.style.borderColor='rgba(242,238,230,.3)'}
                onBlur={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.1)'} />
              <input type="text" placeholder="Last name" value={lastName} onChange={e=>setLastName(e.target.value)} style={inp}
                onFocus={e=>e.currentTarget.style.borderColor='rgba(242,238,230,.3)'}
                onBlur={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.1)'} />
            </div>
          )}
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={inp}
            onFocus={e=>e.currentTarget.style.borderColor='rgba(242,238,230,.3)'}
            onBlur={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.1)'} />
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={inp}
            onKeyDown={e=>e.key==='Enter'&&handle()}
            onFocus={e=>e.currentTarget.style.borderColor='rgba(242,238,230,.3)'}
            onBlur={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.1)'} />
        </div>

        {mode==='signin' && <button onClick={forgot} disabled={loading} className="pressable" style={{background:'none',border:'none',color:'var(--cream-low)',fontSize:'11px',fontFamily:'DM Sans',cursor:'pointer',marginTop:'10px',width:'100%',textAlign:'center',textDecoration:'underline',opacity:loading?.6:1}}>Forgot password?</button>}
        {error && <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'#E5A0A0',marginTop:'10px',textAlign:'center'}}>{error}</div>}
        {notice && <div style={{fontSize:'11px',color:'var(--cream-mid)',marginTop:'10px',textAlign:'center',lineHeight:1.5}}>{notice}</div>}

        <button onClick={handle} disabled={loading} style={{width:'100%',background:'var(--cream)',border:'none',borderRadius:'10px',padding:'14px',color:'var(--bg)',fontWeight:600,fontSize:'13px',cursor:'pointer',fontFamily:'DM Sans',marginTop:'16px',opacity:loading?.6:1,transition:'transform .2s, opacity .2s'}}
          onMouseOver={e=>{if(!loading){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(242,238,230,.15)'}}}
          onMouseOut={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}>
          {loading?'...':mode==='signin'?'Sign In':'Create Account'}
        </button>
      </div>
    </div>
  )
}
