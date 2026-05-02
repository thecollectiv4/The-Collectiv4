import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { ArrowLeft } from 'lucide-react'

export default function Auth() {
  const [mode, setMode] = useState('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const inp = { width:'100%', background:'var(--bg-card)', border:'1px solid var(--border-hi)', borderRadius:'10px', padding:'14px 16px', color:'var(--cream)', fontFamily:'DM Sans', fontSize:'14px', outline:'none' }

  const handle = async () => {
    if (mode==='signup' && !name.trim()) { setError('Name is required'); return }
    setLoading(true); setError('')
    try {
      if (mode==='signin') { const {error}=await signIn(email,password); if(error)throw error; navigate('/') }
      else { const {error}=await signUp(email,password,name.trim()); if(error)throw error; navigate('/') }
    } catch(e){ setError(e.message) } finally{ setLoading(false) }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',justifyContent:'center',padding:'2rem 28px',background:'var(--bg)'}}>
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
            <button key={m} onClick={()=>{setMode(m);setError('')}} style={{flex:1,background:mode===m?'var(--cream)':'transparent',border:'none',borderRadius:'8px',padding:'10px',color:mode===m?'var(--bg)':'var(--cream-low)',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'DM Sans',transition:'all .2s'}}>
              {m==='signin'?'Sign In':'Sign Up'}
            </button>
          ))}
        </div>
        {mode==='signup'&&<input type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={inp}/>}
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={inp}/>
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()} style={inp}/>
        {error&&<div style={{fontSize:'12px',color:'var(--rust)',padding:'10px 14px',background:'var(--rust-dim)',borderRadius:'8px'}}>{error}</div>}
        <button onClick={handle} disabled={loading} style={{width:'100%',background:'var(--cream)',border:'none',borderRadius:'10px',padding:'16px',color:'var(--bg)',fontWeight:600,fontSize:'14px',cursor:'pointer',fontFamily:'DM Sans',opacity:loading?.6:1,marginTop:'4px'}}>
          {loading?'...':mode==='signin'?'Sign In':'Create Account'}
        </button>
      </div>
      <div style={{textAlign:'center',marginTop:'28px',fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-ghost)',letterSpacing:'.1em'}}>ART · MUSIC · FASHION · EVENTS</div>
    </div>
  )
}
