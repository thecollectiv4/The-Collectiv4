import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { LogOut, Calendar, MapPin, Clock, ChevronRight, Sparkles, Copy, Check } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import ProfileMuseum from '@/components/ProfileMuseum'

export default function Profile() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const live = useLiveEvent()
  const [profile, setProfile] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { if (!user) { navigate('/auth'); return } load() }, [user])

  const load = async () => {
    let { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!data) {
      const nm = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
      const { data: newP } = await supabase.from('profiles').insert({
        id: user.id, full_name: nm, username: '', bio: '', city: 'Houston'
      }).select().single()
      data = newP || { id: user.id, full_name: nm, username: '', bio: '', avatar_url: '', city: 'Houston' }
    }
    setProfile(data)

    // Load ticket — key on buyer_id to satisfy tickets_self_read RLS (auth.uid()=buyer_id).
    const { data: tk } = await supabase.from('tickets').select('*').eq('buyer_id', user.id).eq('status', 'confirmed').maybeSingle()
    if (tk) setTicket(tk)
  }

  // Owner save — writes every museum column EXCEPT `verified` (locked to service role
  // by the lock_verified trigger). Passes profiles_self_update RLS (auth.uid()=id).
  const onSave = async (patch) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (error) throw error
  }

  // Image upload — base64-data-URL behavior (Supabase Storage = later cleanup).
  // Settles on EVERY path: read error → reject, DB error → reject, success → resolve.
  const uploadImage = (col) => (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error('Could not read file'))
    reader.onload = async (ev) => {
      try {
        const url = ev.target.result
        const { error } = await supabase.from('profiles').update({ [col]: url }).eq('id', user.id)
        if (error) return reject(error)
        resolve(url)
      } catch (e) { reject(e) }
    }
    reader.readAsDataURL(file)
  })
  const onUploadAvatar = uploadImage('avatar_url')
  // Cover: a file uploads like the avatar; null clears it.
  const onUploadCover = async (file) => {
    if (!file) {
      const { error } = await supabase.from('profiles').update({ cover_url: null }).eq('id', user.id)
      if (error) throw error
      return null
    }
    return uploadImage('cover_url')(file)
  }

  const topBar = (
    <>
      <span />
      <button onClick={async () => { await signOut(); navigate('/') }}
        style={{ background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.2)', borderRadius: '8px', padding: '6px 14px', color: '#EF4444', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Sans', transition: 'all .2s' }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(220,38,38,.15)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(220,38,38,.06)'}>
        <LogOut size={11} /> Sign Out
      </button>
    </>
  )

  const ownerExtras = (
    <>
      {/* YOUR TICKET */}
      <div style={{ marginTop: '44px' }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.3em', color: 'var(--cream-low)', textTransform: 'uppercase', marginBottom: '16px' }}>YOUR TICKET</div>
        {ticket ? (
          <div style={{ border: '1px solid var(--border-hi)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '24px', background: 'var(--bg-card)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '22px', color: 'var(--cream)', marginBottom: '4px' }}>{live.name} {live.editionNumber && <span style={{ color: '#D06020' }}>{live.editionNumber}</span>}</div>
              <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', letterSpacing: '.08em', marginBottom: '20px' }}>{`${live.dateLong} · ${live.city}`.toUpperCase()}</div>
              <div style={{ display: 'inline-block', padding: '16px', background: '#FFFFFF', borderRadius: '12px', marginBottom: '16px' }}>
                <QRCodeSVG value={ticket.qr_code || 'RBA2-TICKET'} size={140} level="H" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'DM Mono', fontSize: '12px', color: 'var(--cream)', letterSpacing: '.04em', fontWeight: 600 }}>{ticket.qr_code}</span>
                <button onClick={() => { navigator.clipboard.writeText(ticket.qr_code); setCopied(true); setTimeout(() => setCopied(false), 2000) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                  {copied ? <Check size={14} style={{ color: '#00D54B' }} /> : <Copy size={14} style={{ color: 'var(--cream-low)' }} />}
                </button>
              </div>
              <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', letterSpacing: '.06em' }}>EARLY BIRD · ${ticket.price_paid || 0} PAID</div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px dashed var(--border-hi)', background: 'rgba(0,213,75,.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00D54B', boxShadow: '0 0 6px rgba(0,213,75,.4)' }} />
              <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: '#00D54B', letterSpacing: '.06em', fontWeight: 600 }}>CONFIRMED</span>
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border-hi)', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'all .3s' }}
            onClick={() => navigate('/')}
            onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(242,230,208,.2)'} onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}>
            <div style={{ padding: '24px', background: 'var(--bg-card)' }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: 'var(--cream)' }}>{live.name} {live.editionNumber && <span style={{ color: '#D06020' }}>{live.editionNumber}</span>}</div>
              <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-low)', marginTop: '4px', letterSpacing: '.08em' }}>{live.edition || 'UPCOMING'}</div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                {[[Calendar, live.dateMed.toUpperCase()], [Clock, '10PM'], [MapPin, 'HTX']].map(([Icon, text], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon size={11} strokeWidth={1.2} style={{ color: 'var(--cream)' }} />
                    <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-mid)', letterSpacing: '.06em' }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px dashed var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-low)' }}>Get your ticket · from $15</span>
              <ChevronRight size={14} style={{ color: 'var(--cream-low)' }} />
            </div>
          </div>
        )}
      </div>

      {/* EVENTS ATTENDED */}
      <div style={{ marginTop: '40px' }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.3em', color: 'var(--cream-low)', textTransform: 'uppercase', marginBottom: '16px' }}>EVENTS ATTENDED</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all .2s' }}
          onClick={() => navigate('/editions')}
          onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(200,96,64,.25)'; e.currentTarget.style.background = 'rgba(200,96,64,.04)' }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'linear-gradient(135deg,rgba(200,96,64,.18),rgba(242,230,208,.06))', border: '1px solid rgba(200,96,64,.3)', borderRadius: '8px', padding: '6px 10px', boxShadow: '0 0 12px rgba(200,96,64,.12)' }}>
              <Sparkles size={12} style={{ color: 'var(--rust)' }} />
              <span style={{ fontFamily: 'Bebas Neue', fontSize: '16px', color: 'var(--rust)' }}>1</span>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cream)' }}>Edition 001 — Sanman Studios</div>
              <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', marginTop: '2px' }}>April 4, 2026</div>
            </div>
          </div>
          <ChevronRight size={14} style={{ color: 'var(--cream-low)' }} />
        </div>
      </div>
    </>
  )

  return (
    <ProfileMuseum
      profile={profile}
      isOwner
      onSave={onSave}
      onUploadAvatar={onUploadAvatar}
      onUploadCover={onUploadCover}
      topBar={topBar}
      ownerExtras={ownerExtras}
    />
  )
}
