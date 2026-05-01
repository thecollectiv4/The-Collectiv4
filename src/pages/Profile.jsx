import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { LogOut, Edit3, Ticket, Calendar, MapPin, Clock } from 'lucide-react'

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
      // Create profile for new user
      const newProfile = {
        id: user.id,
        display_name: user.email.split('@')[0],
        bio: '',
        handle: '',
        city: 'Houston',
      }
      await supabase.from('profiles').insert(newProfile)
      setProfile(newProfile)
      setForm({ display_name: newProfile.display_name, bio: '', handle: '' })
      setEditing(true) // New user, open edit mode
    }
  }

  const saveProfile = async () => {
    await supabase.from('profiles').update({
      display_name: form.display_name,
      bio: form.bio,
      handle: form.handle,
    }).eq('id', user.id)
    setProfile(prev => ({ ...prev, ...form }))
    setEditing(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#5A5248', fontSize: '13px' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0D0B' }}>
      {/* Header area */}
      <div style={{
        height: '120px',
        background: 'linear-gradient(135deg, #1A0A04 0%, #0E0D0B 50%, #1A1210 100%)',
        position: 'relative',
      }}>
        <button onClick={handleSignOut} style={{
          position: 'absolute', top: '16px', right: '16px',
          background: 'rgba(26,24,20,0.8)', border: '1px solid #2A2825',
          borderRadius: '8px', padding: '6px 14px',
          color: '#9A9288', fontSize: '11px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
          fontFamily: 'DM Sans',
        }}>
          <LogOut size={12} /> Sign Out
        </button>
      </div>

      {/* Avatar */}
      <div style={{ padding: '0 24px', marginTop: '-36px' }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #2A2420, #1A1210)',
          border: '3px solid #0E0D0B', outline: '2px solid #C05A2A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Bebas Neue', fontSize: '28px', color: '#C05A2A',
        }}>
          {(profile.display_name || '?')[0].toUpperCase()}
        </div>
      </div>

      {/* Profile info */}
      <div style={{ padding: '16px 24px' }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#5A5248', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                Name
              </label>
              <input
                type="text" placeholder="Your name"
                value={form.display_name}
                onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                style={{
                  width: '100%', background: '#1A1814', border: '1px solid #2A2825',
                  borderRadius: '10px', padding: '12px', color: '#F4F0E8',
                  fontFamily: 'DM Sans', fontSize: '14px', outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#5A5248', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                Handle
              </label>
              <input
                type="text" placeholder="@yourhandle"
                value={form.handle}
                onChange={e => setForm(p => ({ ...p, handle: e.target.value }))}
                style={{
                  width: '100%', background: '#1A1814', border: '1px solid #2A2825',
                  borderRadius: '10px', padding: '12px', color: '#F4F0E8',
                  fontFamily: 'DM Sans', fontSize: '14px', outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#5A5248', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                Bio
              </label>
              <textarea
                placeholder="What do you do? What are you about?"
                value={form.bio}
                onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                rows={3}
                style={{
                  width: '100%', background: '#1A1814', border: '1px solid #2A2825',
                  borderRadius: '10px', padding: '12px', color: '#F4F0E8',
                  fontFamily: 'DM Sans', fontSize: '14px', outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>
            <button onClick={saveProfile} style={{
              background: '#C05A2A', border: 'none', borderRadius: '12px',
              padding: '14px', color: '#F4F0E8', fontFamily: 'Bebas Neue',
              fontSize: '16px', letterSpacing: '0.06em', cursor: 'pointer',
            }}>
              SAVE PROFILE
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: '26px', color: '#F4F0E8', letterSpacing: '0.04em' }}>
                  {profile.display_name || 'Set your name'}
                </div>
                {profile.handle && (
                  <div style={{ fontSize: '13px', color: '#9A9288', marginTop: '2px' }}>
                    @{profile.handle} · Houston
                  </div>
                )}
              </div>
              <button onClick={() => setEditing(true)} style={{
                background: 'none', border: '1px solid #2A2825', borderRadius: '8px',
                padding: '6px 12px', color: '#9A9288', fontSize: '11px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Sans',
              }}>
                <Edit3 size={12} /> Edit
              </button>
            </div>
            {profile.bio && (
              <div style={{ fontSize: '13px', color: '#9A9288', marginTop: '10px', lineHeight: 1.5 }}>
                {profile.bio}
              </div>
            )}
          </>
        )}
      </div>

      {/* Ticket Section */}
      <div style={{ padding: '8px 24px 100px' }}>
        <div style={{
          fontSize: '10px', letterSpacing: '0.2em', color: '#5A5248',
          textTransform: 'uppercase', fontWeight: 600, marginBottom: '14px'
        }}>
          Your Ticket
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #1A1210 0%, #2A1A10 100%)',
          border: '1px solid rgba(192,90,42,0.2)',
          borderRadius: '16px', padding: '24px', position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative circle */}
          <div style={{
            position: 'absolute', top: '-20px', right: '-20px',
            width: '100px', height: '100px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(192,90,42,0.15) 0%, transparent 70%)',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontFamily: 'Bebas Neue', fontSize: '22px', color: '#F4F0E8',
              letterSpacing: '0.04em',
            }}>
              RAN BY <span style={{ color: '#C05A2A' }}>ARTISTS</span>
            </div>
            <div style={{ fontSize: '11px', color: '#5A5248', marginTop: '4px' }}>
              May Edition
            </div>

            <div style={{
              display: 'flex', gap: '20px', marginTop: '20px',
            }}>
              {[
                { icon: Calendar, text: 'May 30' },
                { icon: Clock, text: '10PM' },
                { icon: MapPin, text: 'Houston' },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#9A9288' }}>
                  <Icon size={13} style={{ color: '#C05A2A' }} />
                  {text}
                </div>
              ))}
            </div>

            {/* Ticket status */}
            <div style={{
              marginTop: '20px', padding: '12px 16px',
              background: 'rgba(90,82,72,0.15)', borderRadius: '10px',
              border: '1px dashed #2A2825',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'DM Mono, monospace', fontSize: '11px',
                color: '#9A9288', letterSpacing: '0.05em',
              }}>
                Tickets go live May 15
              </div>
              <div style={{ fontSize: '10px', color: '#5A5248', marginTop: '4px' }}>
                Early bird from $15
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
