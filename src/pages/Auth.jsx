import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { humanizeAuthError } from '@/lib/authErrors'
import { ArrowLeft } from 'lucide-react'

export default function Auth() {
  const [mode, setMode] = useState('signup')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Only ever honor a local, same-app return path (leading "/", no "//") — never an
  // open redirect to an external URL.
  const rawNext = searchParams.get('next') || ''
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : '/'
  const inp = { width:'100%', background:'var(--bg-card)', border:'1px solid var(--border-hi)', borderRadius:'10px', padding:'14px 16px', color:'var(--cream)', fontFamily:'DM Sans', fontSize:'14px', outline:'none' }

  const handle = async () => {
    if (mode==='signup' && (!firstName.trim() || !lastName.trim())) { setError('Enter your first and last name'); return }
    setLoading(true); setError(''); setNotice('')
    try {
      // Everyone — members included — lands on the public app after signing in.
      // The OS is reached deliberately via its own server-gated entry (the OS tab
      // in the nav, shown only to network members), never by an auto-redirect.
      if (mode==='signin') { const {error}=await signIn(email,password); if(error)throw error; navigate(next) }
      else {
        const fullName = `${firstName.trim()} ${lastName.trim()}`
        const {error}=await signUp(email,password,fullName,{first_name:firstName.trim(),last_name:lastName.trim()}); if(error)throw error; navigate(next)
      }
    } catch(e){ setError(humanizeAuthError(e)) } finally{ setLoading(false) }
  }

  // D3: forgot password — send the reset link. Anti-enumeration: the same
  // confirmation shows whether or not an account exists at that email.
  const forgot = async () => {
    if (!email.trim()) { setError('Enter your email to get the reset link'); return }
    setLoading(true); setError(''); setNotice('')
    try {
      await resetPassword(email.trim())
      setNotice('If an account exists for that email, we sent a link to reset your password.')
    } catch(e){ setError(humanizeAuthError(e)) } finally{ setLoading(false) }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',justifyContent:'center',padding:'2rem 28px',background:'linear-gradient(180deg,#0A0A0D 0%,#0A0A0D 20%,#0A0A0D 40%,#0A0A0D 100%)'}}>
      <button onClick={()=>navigate('/')} style={{position:'absolute',top:'20px',left:'20px',background:'none',border:'none',color:'var(--cream-low)',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',fontFamily:'DM Sans'}}>
        <ArrowLeft size={14}/> Back
      </button>
      <div style={{textAlign:'center',marginBottom:'36px'}}>
        <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em'}}>THE COLLECTIV4</div>
        <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',marginTop:'8px',letterSpacing:'.15em'}}>{mode==='signup'?'CREATE YOUR ACCOUNT':'WELCOME BACK'}</div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
        <div style={{display:'flex',background:'var(--bg-card)',borderRadius:'10px',padding:'3px',marginBottom:'8px'}}>
          {['signup','signin'].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setError('');setNotice('')}} style={{flex:1,background:mode===m?'var(--cream)':'transparent',border:'none',borderRadius:'8px',padding:'10px',color:mode===m?'var(--bg)':'var(--cream-low)',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'DM Sans',transition:'background .2s, color .2s'}}>
              {m==='signin'?'Sign In':'Sign Up'}
            </button>
          ))}
        </div>
        {mode==='signup'&&<div style={{display:'flex',gap:'8px'}}>
          <input type="text" placeholder="First name" value={firstName} onChange={e=>setFirstName(e.target.value)} style={inp}/>
          <input type="text" placeholder="Last name" value={lastName} onChange={e=>setLastName(e.target.value)} style={inp}/>
        </div>}
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={inp}/>
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()} style={inp}/>
        {mode==='signin'&&<button onClick={forgot} disabled={loading} style={{background:'none',border:'none',color:'var(--cream-low)',fontSize:'12px',fontFamily:'DM Sans',cursor:'pointer',textAlign:'right',padding:'2px',textDecoration:'underline',opacity:loading?.6:1}}>Forgot password?</button>}
        {error&&<div style={{fontSize:'12px',color:'var(--rust)',padding:'10px 14px',background:'var(--rust-dim)',borderRadius:'8px'}}>{error}</div>}
        {notice&&<div style={{fontSize:'12px',color:'var(--cream-mid)',padding:'10px 14px',background:'rgba(242,238,230,.06)',border:'1px solid rgba(242,238,230,.12)',borderRadius:'8px',lineHeight:1.5}}>{notice}</div>}
        <button onClick={handle} disabled={loading} style={{width:'100%',background:'var(--cream)',border:'none',borderRadius:'10px',padding:'16px',color:'var(--bg)',fontWeight:600,fontSize:'14px',cursor:'pointer',fontFamily:'DM Sans',opacity:loading?.6:1,marginTop:'4px',transition:'transform .25s, opacity .25s'}}
          onMouseOver={e=>{if(!loading){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(242,238,230,.15)'}}}
          onMouseOut={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}>
          {loading?'...':mode==='signin'?'Sign In':'Create Account'}
        </button>
      </div>
      <div style={{textAlign:'center',marginTop:'28px',fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-ghost)',letterSpacing:'.1em'}}>ART · MUSIC · FASHION · EVENTS</div>
    </div>
  )
}
