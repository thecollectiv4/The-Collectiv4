import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { humanizeAuthError } from '@/lib/authErrors'
import { fetchGateEnabled, humanizeGateError } from '@/lib/earlyAccess'
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
  /* v12 — LA PUERTA. This modal is the app's OTHER signup path (it calls
     supabase.auth.signUp directly and never touches AuthContext), so it is
     exactly where a gate springs a hole in its own UI. It does NOT host a
     second gate: when the flag is on, the signup tab disappears here and
     the visitor is sent to /auth, which is the one door. Sign-in in this
     modal is never gated. */
  const [gate, setGate] = useState(false)
  const navigate = useNavigate()
  useEffect(() => { let ok = true; fetchGateEnabled().then(v => { if (ok) setGate(v) }); return () => { ok = false } }, [])
  useEffect(() => { if (gate && mode === 'signup') setMode('signin') }, [gate, mode])

  const handle = async () => {
    if (mode === 'signup' && (!firstName.trim() || !lastName.trim())) { setError('Escribe tu nombre y apellido'); return }
    setLoading(true); setError(''); setNotice('')
    try {
      if (mode === 'signup') {
        // Belt and braces: if the gate turned on between mount and submit,
        // hand the visitor to the real door instead of a rejected signup.
        if (gate) { setLoading(false); onClose(); navigate('/auth'); return }
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
    } catch (e) { setError(humanizeGateError(e) || humanizeAuthError(e)) }
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

        {/* Toggle — v12: with the gate ON there is nothing to toggle to.
            Creating an account is not a tab anymore, it is a door. */}
        {!gate && (
          <div style={{display:'flex',gap:'4px',marginBottom:'20px',background:'var(--bg-raised)',borderRadius:'10px',padding:'3px'}}>
            {['signin','signup'].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setError('');setNotice('')}} className="pressable" style={{flex:1,background:mode===m?'rgba(242,238,230,.08)':'transparent',border:'none',borderRadius:'8px',padding:'8px',color:mode===m?'var(--cream)':'var(--cream-low)',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'DM Sans',transition:'background .2s, color .2s'}}>
                {m==='signin'?'Sign In':'Create Account'}
              </button>
            ))}
          </div>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {/* name row stays mounted and collapses via grid-template-rows so the
              email/password inputs glide instead of teleporting on mode toggle (A-06) */}
          <div className="row-collapse" aria-hidden={mode!=='signup'} style={{display:'grid',gridTemplateRows:mode==='signup'?'1fr':'0fr',opacity:mode==='signup'?1:0}}>
            <div style={{overflow:'hidden',minHeight:0}}>
              <div style={{display:'flex',gap:'8px'}}>
                <input type="text" placeholder="First name" value={firstName} onChange={e=>setFirstName(e.target.value)} style={inp} tabIndex={mode==='signup'?0:-1}
                  onFocus={e=>e.currentTarget.style.borderColor='rgba(242,238,230,.3)'}
                  onBlur={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.1)'} />
                <input type="text" placeholder="Last name" value={lastName} onChange={e=>setLastName(e.target.value)} style={inp} tabIndex={mode==='signup'?0:-1}
                  onFocus={e=>e.currentTarget.style.borderColor='rgba(242,238,230,.3)'}
                  onBlur={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.1)'} />
              </div>
            </div>
          </div>
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

        {/* v12: the way to the door, for someone who has no account yet.
            Never a dead end (Ley 9) — it goes to the real gate. */}
        {gate && (
          <div style={{marginTop:'18px',paddingTop:'16px',borderTop:'1px solid rgba(242,238,230,.08)',textAlign:'center'}}>
            <button onClick={()=>{onClose();navigate('/auth')}} className="pressable" style={{background:'none',border:'none',cursor:'pointer',fontFamily:'DM Sans',fontSize:'12px',color:'var(--cream-low)',padding:'4px'}}>
              New here? <span style={{color:'var(--cream-mid)',textDecoration:'underline',textUnderlineOffset:'3px'}}>Early access is by invitation&nbsp;→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
