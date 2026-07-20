import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { humanizeAuthError } from '@/lib/authErrors'
import { ArrowLeft, Loader2 } from 'lucide-react'

/* =========================================================================
   /reset-password — where the reset email's link lands (D3, El Mundo v7).
   supabase-js (detectSessionInUrl) parses the recovery token from the URL
   hash and establishes a temporary recovery session, so useAuth().user is
   populated here. We set the new password with updateUser and send them in.
   If there is no session (link expired / opened cold), we say so plainly and
   point back to sign-in — never a code, never a dead screen.
   ========================================================================= */

export default function ResetPassword() {
  const { user, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const inp = { width:'100%', background:'var(--bg-card)', border:'1px solid var(--border-hi)', borderRadius:'10px', padding:'14px 16px', color:'var(--cream)', fontFamily:'DM Sans', fontSize:'14px', outline:'none' }
  // v12: transparent + zIndex 1 — the shared sky paints behind (App.jsx).
  const wrap = { minHeight:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', padding:'2rem 28px', textAlign:'center', background:'transparent', position:'relative', zIndex:1 }

  const submit = async () => {
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setBusy(true); setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => navigate('/profile'), 1400)
    } catch (e) { setError(humanizeAuthError(e)) } finally { setBusy(false) }
  }

  if (loading) {
    return (
      <div style={wrap}>
        <Loader2 size={22} style={{ color:'var(--cream-low)', animation:'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (!user) {
    return (
      <div style={wrap}>
        <div style={{ fontFamily:'Bebas Neue', fontSize:'28px', color:'var(--cream)', letterSpacing:'.02em', marginBottom:'8px' }}>ESE ENLACE YA NO SIRVE</div>
        <div style={{ fontSize:'13px', color:'var(--cream-low)', lineHeight:1.6, marginBottom:'20px', maxWidth:'320px' }}>El enlace para restablecer tu contraseña expiró o ya se usó. Pide uno nuevo desde la pantalla de acceso.</div>
        <button className="pressable" onClick={() => navigate('/auth')}
          style={{ background:'rgba(var(--ink-rgb),.06)', border:'1px solid rgba(var(--ink-rgb),.18)', borderRadius:'100px', padding:'10px 20px', color:'var(--cream-mid)', fontFamily:'DM Mono', fontSize:'10px', letterSpacing:'.12em', textTransform:'uppercase', cursor:'pointer' }}>
          ← Acceder
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div style={wrap}>
        <div style={{ fontFamily:'Bebas Neue', fontSize:'28px', color:'var(--cream)', letterSpacing:'.02em', marginBottom:'8px' }}>LISTO</div>
        <div style={{ fontSize:'13px', color:'var(--cream-low)', lineHeight:1.6 }}>Tu contraseña quedó actualizada. Entrando…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', padding:'2rem 28px', background:'transparent', position:'relative', zIndex:1 }}>
      <button onClick={() => navigate('/auth')} style={{ position:'absolute', top:'20px', left:'20px', background:'none', border:'none', color:'var(--cream-low)', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', fontFamily:'DM Sans' }}>
        <ArrowLeft size={14}/> Acceder
      </button>
      <div style={{ textAlign:'center', marginBottom:'36px' }}>
        <div style={{ fontFamily:'Bebas Neue', fontSize:'28px', color:'var(--cream)', letterSpacing:'.02em' }}>NUEVA CONTRASEÑA</div>
        <div style={{ fontFamily:'DM Mono', fontSize:'10px', color:'var(--cream-low)', marginTop:'8px', letterSpacing:'.15em' }}>ELIGE UNA NUEVA</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        <input type="password" placeholder="Nueva contraseña" value={password} onChange={e=>setPassword(e.target.value)} style={inp}/>
        <input type="password" placeholder="Confírmala" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} style={inp}/>
        {error && <div style={{ fontSize:'12px', color:'var(--rust)', padding:'10px 14px', background:'var(--rust-dim)', borderRadius:'8px' }}>{error}</div>}
        <button onClick={submit} disabled={busy} style={{ width:'100%', background:'var(--cream)', border:'none', borderRadius:'10px', padding:'16px', color:'var(--bg)', fontWeight:600, fontSize:'14px', cursor:'pointer', fontFamily:'DM Sans', opacity:busy?.6:1, marginTop:'4px' }}>
          {busy ? '...' : 'Guardar contraseña'}
        </button>
      </div>
    </div>
  )
}
