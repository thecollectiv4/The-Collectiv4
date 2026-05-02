import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { Lock, Sparkles, Ticket } from 'lucide-react'

export default function Attendees() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [attendees, setAttendees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('tickets').select('*').eq('status','confirmed').order('created_at',{ascending:false})
      .then(({data}) => { setAttendees(data||[]); setLoading(false) })
      .catch(() => { setAttendees([]); setLoading(false) })
  }, [])

  if (!user) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 28px',textAlign:'center',background:'var(--bg)'}}>
      <Lock size={24} strokeWidth={1.2} style={{color:'var(--cream-low)',marginBottom:'20px'}}/>
      <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em',marginBottom:'8px'}}>SEE WHO'S GOING</div>
      <div style={{fontSize:'13px',color:'var(--cream-low)',marginBottom:'28px',lineHeight:1.6}}>Create an account to see and connect with other attendees.</div>
      <button onClick={()=>navigate('/auth')} style={{background:'var(--cream)',border:'none',borderRadius:'10px',padding:'14px 36px',color:'var(--bg)',fontFamily:'DM Sans',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Join</button>
    </div>
  )

  return (
    <div style={{background:'linear-gradient(180deg,#0E0D0C 0%,#0C0B0A 20%,#0A0908 40%,#0A0908 100%)',minHeight:'100vh'}}>
      <div style={{padding:'20px 28px 16px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream-low)',textTransform:'uppercase'}}>Ran By Artists · May 30</div>
        <div style={{fontFamily:'Bebas Neue',fontSize:'32px',color:'var(--cream)',letterSpacing:'.02em',marginTop:'6px'}}>WHO'S GOING</div>
        <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',marginTop:'6px',letterSpacing:'.06em'}}>{attendees.length} CONFIRMED</div>
      </div>
      <div style={{padding:'0 28px 100px'}}>
        {loading ? (
          <div style={{textAlign:'center',padding:'40px',color:'var(--cream-low)',fontSize:'13px'}}>Loading...</div>
        ) : attendees.length === 0 ? (
          <div style={{textAlign:'center',padding:'40px',border:'1px solid var(--border)',borderRadius:'12px'}}>
            <Ticket size={20} strokeWidth={1.2} style={{color:'var(--cream-low)',marginBottom:'12px'}}/>
            <div style={{fontFamily:'Bebas Neue',fontSize:'20px',color:'var(--cream)',marginBottom:'6px'}}>BE THE FIRST</div>
            <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',letterSpacing:'.06em'}}>No tickets sold yet — grab yours and be first on the list</div>
            <button onClick={()=>navigate('/')} style={{marginTop:'16px',background:'var(--cream)',border:'none',borderRadius:'8px',padding:'10px 24px',color:'var(--bg)',fontFamily:'DM Sans',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>Get Ticket</button>
          </div>
        ) : (
          <>
            {attendees.map((a,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:'14px',padding:'16px 0',borderBottom:i<attendees.length-1?'1px solid var(--border)':'none'}}>
                <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'var(--bg-raised)',border:'1px solid var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'16px',color:'var(--gold)',flexShrink:0}}>
                  {(a.email||'?')[0].toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'14px',fontWeight:500,color:'var(--cream)'}}>{a.email?.split('@')[0] || 'Attendee'}</div>
                  <div style={{fontSize:'11px',color:'var(--cream-low)',marginTop:'2px'}}>{a.tier?.toUpperCase()} ticket</div>
                </div>
                <span style={{fontFamily:'DM Mono',fontSize:'8px',letterSpacing:'.1em',color:'var(--cream-mid)',border:'1px solid var(--border-hi)',padding:'3px 10px',borderRadius:'100px',flexShrink:0}}>GOING</span>
              </div>
            ))}
            <div style={{textAlign:'center',padding:'28px',marginTop:'16px',border:'1px solid var(--border)',borderRadius:'12px'}}>
              <Sparkles size={16} strokeWidth={1.2} style={{color:'var(--cream-low)',marginBottom:'8px'}}/>
              <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',letterSpacing:'.06em'}}>More joining every day</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
