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

  const handle = async () => {
    setLoading(true)
    setError('')
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/')
      } else {
        const { error, data } = await signUp(email, password)
        if (error) throw error
        // If email confirmation required
        if (data?.user && !data.session) {
          setSuccess(true)
        } else {
          navigate('/')
        }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem', background: '#0E0D0B', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🖤</div>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: '#F4F0E8', letterSpacing: '0.04em', marginBottom: '12px' }}>
          CHECK YOUR EMAIL
        </div>
        <div style={{ fontSize: '13px', color: '#9A9288', lineHeight: 1.6, marginBottom: '24px' }}>
          We sent a confirmation link to <strong style={{ color: '#F4F0E8' }}>{email}</strong>.<br/>
          Click it and you're in.
        </div>
        <button onClick={() => { setSuccess(false); setMode('signin') }} style={{
          background: 'none', border: '1px solid #2A2825', borderRadius: '10px',
          padding: '12px', color: '#9A9288', fontSize: '13px', cursor: 'pointer',
          fontFamily: 'DM Sans',
        }}>
          Already confirmed? Sign In
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem', background: '#0E0D0B' }}>
      
      {/* Back button */}
      <button onClick={() => navigate('/')} style={{
        position: 'absolute', top: '20px', left: '20px',
        background: 'none', border: 'none', color: '#5A5248',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '13px', fontFamily: 'DM Sans',
      }}>
        <ArrowLeft size={16} /> Back to event
      </button>

      {/* Header */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '2.2rem', letterSpacing: '0.06em', color: '#F4F0E8' }}>
          THE <span style={{ color: '#C05A2A' }}>COLLECTIV4</span>
        </div>
        <div style={{ fontSize: '12px', color: '#5A5248', marginTop: '8px', lineHeight: 1.5 }}>
          {mode === 'signup'
            ? 'Create your account to get your ticket and join the community.'
            : 'Welcome back. Sign in to access the event.'
          }
        </div>
      </div>

      <div style={{ background: '#1A1814', border: '1px solid #2A2825', borderRadius: 16, padding: '1.5rem' }}>
        {/* Toggle */}
        <div style={{ display: 'flex', marginBottom: '1.25rem', background: '#0E0D0B', borderRadius: 10, padding: 4 }}>
          {['signup', 'signin'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }} style={{
              flex: 1, background: mode === m ? '#C05A2A' : 'transparent',
              border: 'none', borderRadius: 8, padding: '10px',
              color: mode === m ? '#F4F0E8' : '#5A5248',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans',
              transition: 'all 0.2s',
            }}>
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Name field (signup only) */}
        {mode === 'signup' && (
          <input type="text" placeholder="Your name" value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: '100%', background: '#0E0D0B', border: '1px solid #2A2825',
              borderRadius: 10, padding: '13px 16px', color: '#F4F0E8',
              fontFamily: 'DM Sans', fontSize: '14px', marginBottom: '10px', outline: 'none',
            }} />
        )}

        <input type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)}
          style={{
            width: '100%', background: '#0E0D0B', border: '1px solid #2A2825',
            borderRadius: 10, padding: '13px 16px', color: '#F4F0E8',
            fontFamily: 'DM Sans', fontSize: '14px', marginBottom: '10px', outline: 'none',
          }} />

        <input type="password" placeholder="Password (min 6 characters)" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handle()}
          style={{
            width: '100%', background: '#0E0D0B', border: '1px solid #2A2825',
            borderRadius: 10, padding: '13px 16px', color: '#F4F0E8',
            fontFamily: 'DM Sans', fontSize: '14px', marginBottom: '1rem', outline: 'none',
          }} />

        {error && (
          <div style={{ color: '#E05A3A', fontSize: '12px', marginBottom: '12px', padding: '8px 12px', background: 'rgba(224,90,58,0.1)', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <button onClick={handle} disabled={loading} style={{
          width: '100%', background: '#C05A2A', border: 'none', borderRadius: 12,
          padding: '15px', color: '#F4F0E8', fontWeight: 600,
          fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans',
          opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
        }}>
          {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '11px', color: '#3A3428' }}>
        By joining you agree to keep it real. 🖤
      </div>
    </div>
  )
}
