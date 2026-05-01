import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

export default function Auth() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handle = async () => {
    setLoading(true)
    setError('')
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else {
        const { error } = await signUp(email, password)
        if (error) throw error
      }
      navigate('/')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem', background: '#0E0D0B' }}>
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '2.5rem', letterSpacing: '0.06em', color: '#F4F0E8' }}>
          THE <span style={{ color: '#C05A2A' }}>COLLECTIV4</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#9A9288', marginTop: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Houston's Creative Network
        </div>
      </div>

      <div style={{ background: '#1A1814', border: '1px solid #2A2825', borderRadius: 16, padding: '1.5rem' }}>
        <div style={{ display: 'flex', marginBottom: '1.25rem', background: '#0E0D0B', borderRadius: 10, padding: 4 }}>
          {['signin', 'signup'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ flex: 1, background: mode === m ? '#C05A2A' : 'transparent', border: 'none', borderRadius: 8, padding: '8px', color: mode === m ? '#F4F0E8' : '#9A9288', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans' }}>
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', background: '#0E0D0B', border: '1px solid #2A2825', borderRadius: 10, padding: '12px', color: '#F4F0E8', fontFamily: 'DM Sans', fontSize: '0.875rem', marginBottom: '0.75rem', outline: 'none' }} />

        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', background: '#0E0D0B', border: '1px solid #2A2825', borderRadius: 10, padding: '12px', color: '#F4F0E8', fontFamily: 'DM Sans', fontSize: '0.875rem', marginBottom: '1rem', outline: 'none' }} />

        {error && <div style={{ color: '#E05A3A', fontSize: '0.78rem', marginBottom: '0.75rem' }}>{error}</div>}

        <button onClick={handle} disabled={loading} style={{ width: '100%', background: '#C05A2A', border: 'none', borderRadius: 10, padding: '13px', color: '#F4F0E8', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'DM Sans', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Loading...' : mode === 'signin' ? 'Enter the Collective' : 'Join the Collective'}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.72rem', color: '#5A5248' }}>
        Houston · Austin · NYC · CDMX — Coming soon
      </div>
    </div>
  )
}
