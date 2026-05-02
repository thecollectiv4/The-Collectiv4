import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { ArrowLeft, MapPin, Calendar } from 'lucide-react'

export default function UserProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Try loading profile by id
      const {data:p} = await supabase.from('profiles').select('*').eq('id',id).single()
      if(p) setProfile(p)

      // Load their ticket
      const {data:t} = await supabase.from('tickets').select('*').eq('buyer_id',id).eq('status','confirmed').maybeSingle()
      if(t) {
        setTicket(t)
        if(!p) setProfile({ full_name: t.buyer_name, bio: '', city: 'Houston' })
      }

      setLoading(false)
    }
    load()
  }, [id])

  if(loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}><div style={{color:'var(--cream-low)',fontSize:'13px'}}>Loading...</div></div>

  const name = profile?.full_name || ticket?.buyer_name || 'Attendee'

  return (
    <div style={{background:'linear-gradient(180deg,#0E0D0C 0%,#0C0B0A 20%,#0A0908 40%,#0A0908 100%)',minHeight:'100vh'}}>
      {/* Header */}
      <div style={{padding:'16px 28px',display:'flex',alignItems:'center',gap:'12px'}}>
        <button onClick={()=>navigate(-1)} style={{background:'none',border:'none',color:'var(--cream)',cursor:'pointer'}}><ArrowLeft size={18}/></button>
        <div style={{fontFamily:'Bebas Neue',fontSize:'16px',color:'var(--cream)',letterSpacing:'.06em'}}>PROFILE</div>
      </div>

      {/* Avatar & Name */}
      <div style={{padding:'32px 28px',textAlign:'center'}}>
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" style={{width:'90px',height:'90px',borderRadius:'50%',objectFit:'cover',border:'2px solid rgba(242,230,208,.15)',margin:'0 auto 16px'}} />
        ) : (
          <div style={{width:'90px',height:'90px',borderRadius:'50%',background:'var(--bg-raised)',border:'2px solid rgba(242,230,208,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'38px',color:'var(--cream)',margin:'0 auto 16px'}}>
            {name[0].toUpperCase()}
          </div>
        )}
        <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em'}}>{name}</div>
        {profile?.username && <div style={{fontFamily:'DM Mono',fontSize:'11px',color:'var(--cream-mid)',marginTop:'4px'}}>@{profile.username}</div>}
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',marginTop:'8px'}}>
          <MapPin size={11} style={{color:'var(--cream-low)'}} />
          <span style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)'}}>{profile?.city || 'Houston'}</span>
        </div>
        {profile?.bio && <p style={{fontSize:'13px',color:'var(--cream-mid)',lineHeight:1.6,marginTop:'16px',maxWidth:'280px',margin:'16px auto 0'}}>{profile.bio}</p>}
      </div>

      {/* Ticket badge */}
      {ticket && (
        <div style={{padding:'0 28px'}}>
          <div style={{padding:'16px 20px',borderRadius:'12px',background:'rgba(0,213,75,.04)',border:'1px solid rgba(0,213,75,.12)',display:'flex',alignItems:'center',gap:'12px'}}>
            <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#00D54B',boxShadow:'0 0 6px rgba(0,213,75,.4)',flexShrink:0}} />
            <div>
              <div style={{fontSize:'13px',fontWeight:600,color:'var(--cream)'}}>Going to RBA Edition 002</div>
              <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'2px'}}>May 30, 2026 · Houston</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
