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
  const [form, setForm] = useState({ display_name: '', bio: '', handle: '' })

  useEffect(() => {
    if (!user) { navigate('/auth'); return }
    loadProfile()
  }, [user])

  const loadProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data)
      setForm({ display_name: data.display_name || '', bio: data.bio || '', handle: data.handle || '' })
    } else {
      const np = { id: user.id, display_name: user.email.split('@')[0], bio: '', handle: '', city: 'Houston' }
      await supabase.from('profiles').insert(np)
      setProfile(np)
      setForm({ display_name: np.display_name, bio: '', handle: '' })
      setEditing(true)
    }
  }

  const saveProfile = async () => {
    await supabase.from('profiles').update(form).eq('id', user.id)
    setProfile(prev => ({ ...prev, ...form }))
    setEditing(false)
  }

  const inputStyle = {
    width: '100%', background: '#0A0A0A', border: '1px solid #1A1A1A',
    borderRadius: '10px', padding: '14px 16px', color: '#FFF',
    fontFamily: 'DM Sans', fontSize: '14px', outline: 'none',
  }

  if (!profile) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'DM Mono', fontSize: '11px', color: '#333' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      {/* Header */}
      <div style={{ height: '100px', background: '#0A0A0A', position: 'relative' }}>
        <button onClick={async () => { await signOut(); navigate('/') }} style={{
          position: 'absolute', top: '14px', right: '14px',
          background: 'none', border: '1px solid #222',
          borderRadius: '8px', padding: '6px 14px',
          color: '#555', fontSize: '11px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Sans',
        }}>
          <LogOut size={11} /> Out
        </button>
      </div>

      {/* Avatar */}
      <div style={{ padding: '0 28px', marginTop: '-30px' }}>
        <div style={{
          width: '60px', height: '60px', borderRadius: '50%',
          background: '#111', border: '3px solid #000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Bebas Neue', fontSize: '24px', color: '#FFF',
        }}>
          {(profile.display_name || '?')[0].toUpperCase()}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '16px 28px' }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '0.2em', color: '#444', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>NAME</label>
              <input type="text" placeholder="Your name" value={form.display_name}
                onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '0.2em', color: '#444', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>HANDLE</label>
              <input type="text" placeholder="@yourhandle" value={form.handle}
                onChange={e => setForm(p => ({ ...p, handle: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '0.2em', color: '#444', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>BIO</label>
              <textarea placeholder="What do you do?" value={form.bio} rows={3}
                onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <button onClick={saveProfile} style={{
              background: '#FFF', border: 'none', borderRadius: '10px',
              padding: '14px', color: '#000', fontWeight: 600,
              fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans',
            }}>
              Save
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: '#FFF', letterSpacing: '0.02em' }}>
                  {profile.display_name || 'Set your name'}
                </div>
                {profile.handle && (
                  <div style={{ fontFamily: 'DM Mono', fontSize: '12px', color: '#555', marginTop: '2px' }}>
                    @{profile.handle}
                  </div>
                )}
              </div>
              <button onClick={() => setEditing(true)} style={{
                background: 'none', border: '1px solid #222', borderRadius: '8px',
                padding: '6px 14px', color: '#555', fontSize: '11px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Sans',
              }}>
                <Edit3 size={11} /> Edit
              </button>
            </div>
            {profile.bio && (
              <div style={{ fontSize: '13px', color: '#666', marginTop: '10px', lineHeight: 1.6 }}>
                {profile.bio}
              </div>
            )}
          </>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: '#1A1A1A', margin: '8px 28px' }} />

      {/* Ticket */}
      <div style={{ padding: '24px 28px 100px' }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '0.3em', color: '#444', textTransform: 'uppercase', marginBottom: '16px' }}>
          YOUR TICKET
        </div>

        <div style={{
          border: '1px solid #1A1A1A', borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '24px', background: '#0A0A0A' }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: '#FFF', letterSpacing: '0.02em' }}>
              RAN BY ARTISTS
            </div>
            <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: '#444', marginTop: '4px', letterSpacing: '0.08em' }}>
              MAY EDITION
            </div>

            <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
              {[
                { icon: Calendar, text: 'MAY 30' },
                { icon: Clock, text: '10PM' },
                { icon: MapPin, text: 'HTX' },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon size={11} strokeWidth={1.2} style={{ color: '#444' }} />
                  <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: '#666', letterSpacing: '0.06em' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding: '16px 24px', borderTop: '1px dashed #1A1A1A',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: '#555', letterSpacing: '0.06em' }}>
              Tickets go live May 15 · Early bird $15
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
