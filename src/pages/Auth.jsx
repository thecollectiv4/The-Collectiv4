import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { ArrowLeft } from 'lucide-react'

export default function Auth() {
  const [mode, setMode] = useState('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const inputStyle = {
    width: '100%', background: '#0A0A0A', border: '1px solid #1A1A1A',
    borderRadius: '10px', padding: '14px 16px', color: '#FFF',
    fontFamily: 'DM Sans', fontSize: '14px', outline: 'none',
    transition: 'border-color 0.2s',
  }

  const handle = async () => {
    setLoading(true); setError('')
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/')
      } else {
        const { error, data } = await signUp(email, password)
        if (error) throw error
        if (data?.user && !data.session) setSuccess(true)
        else navigate('/')
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 28px', background: '#000', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '32px', color: '#FFF', letterSpacing: '0.02em', marginBottom: '12px' }}>
          CHECK YOUR EMAIL
        </div>
        <div style={{ fontSize: '13px', color: '#666', lineHeight: 1.7, marginBottom: '28px' }}>
          We sent a confirmation link to <strong style={{ color: '#FFF' }}>{email}</strong>. Click it and you're in.
        </div>
        <button onClick={() => { setSuccess(false); setMode('signin') }} style={{
          background: 'none', border: '1px solid #333', borderRadius: '10px',
          padding: '14px', color: '#888', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans',
        }}>
          Already confirmed? Sign In
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 28px', background: '#000' }}>
      
      <button onClick={() => navigate('/')} style={{
        position: 'absolute', top: '20px', left: '20px',
        background: 'none', border: 'none', color: '#444',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '12px', fontFamily: 'DM Sans',
      }}>
        <ArrowLeft size={14} /> Back
      </button>

      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: '#FFF', letterSpacing: '0.02em' }}>
          THE COLLECTIV4
        </div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#444', marginTop: '8px', letterSpacing: '0.15em' }}>
          {mode === 'signup' ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Toggle */}
        <div style={{ display: 'flex', background: '#0A0A0A', borderRadius: '10px', padding: '3px', marginBottom: '8px' }}>
          {['signup', 'signin'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }} style={{
              flex: 1, background: mode === m ? '#FFF' : 'transparent',
              border: 'none', borderRadius: '8px', padding: '10px',
              color: mode === m ? '#000' : '#444',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans',
              transition: 'all 0.2s',
            }}>
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {mode === 'signup' && (
          <input type="text" placeholder="Your name" value={name}
            onChange={e => setName(e.target.value)} style={inputStyle} />
        )}

        <input type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} style={inputStyle} />

        <input type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handle()}
          style={inputStyle} />

        {error && (
          <div style={{ fontSize: '12px', color: '#C05A2A', padding: '10px 14px', background: 'rgba(192,90,42,0.08)', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <button onClick={handle} disabled={loading} style={{
          width: '100%', background: '#FFF', border: 'none', borderRadius: '10px',
          padding: '16px', color: '#000', fontWeight: 600,
          fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans',
          opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
          marginTop: '4px',
        }}>
          {loading ? '...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '28px', fontFamily: 'DM Mono, monospace', fontSize: '9px', color: '#333', letterSpacing: '0.1em' }}>
        ART · MUSIC · FASHION · EVENTS
      </div>
    </div>
  )
}
