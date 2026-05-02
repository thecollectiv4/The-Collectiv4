import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/api/supabase'

const SEED = {
  'seed-marcus':  { display_name:'Marcus Cole',     bio:'Producer & sound engineer. Houston born.',          tag:'MUSIC',    handle:'@marcuscole'    },
  'seed-jasmine': { display_name:'Jasmine Okafor',  bio:'Visual artist & muralist. Creates worlds on walls.', tag:'ART',      handle:'@jasmineokafor'  },
  'seed-devon':   { display_name:'Devon Mitchell',  bio:'House DJ. Vinyl collector. Student of sound.',       tag:'DJ',       handle:'@devonmitchell'  },
  'seed-sofia':   { display_name:'Sofía Reyes',     bio:'Fashion designer. Founder of her own label.',        tag:'FASHION',  handle:'@sofiareyes'     },
  'seed-andre':   { display_name:'André Williams',  bio:'Photographer & filmmaker. Documenting Houston.',     tag:'PHOTO',    handle:'@andrewilliams'  },
  'seed-lila':    { display_name:'Lila Chen',        bio:'Gallery curator. Building Houston art spaces.',      tag:'CURATOR',  handle:'@lilachen'       },
  'seed-carlos':  { display_name:'Carlos Mendoza',  bio:'Graphic design & branding. Identity first.',         tag:'DESIGN',   handle:'@carlosmendoza'  },
  'seed-amara':   { display_name:'Amara Diallo',    bio:'Poet & creative director. Words that move.',         tag:'CREATIVE', handle:'@amaradiallo'    },
  'seed-pato':    { display_name:'Pato Durán',       bio:'DJ & Founder, The Collectiv4.',                     tag:'FOUNDER',  handle:'@patoduranc'     },
  'seed-diego':   { display_name:'Diego Villaseñor',bio:'Creative Director. Visurelic.',                      tag:'CREATIVE', handle:'@visurelic'      },
}

export default function AttendeeProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const seed = SEED[id]
    if (seed) { setProfile(seed); setLoading(false); return }
    supabase.from('profiles').select('*').eq('id', id).single()
      .then(({ data }) => setProfile(data))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}><div style={{fontFamily:'DM Mono',fontSize:'11px',color:'var(--cream-low)'}}>Loading...</div></div>
  if (!profile) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}><div style={{fontSize:'13px',color:'var(--cream-low)'}}>Profile not found</div></div>

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh'}}>
      <div style={{position:'relative',height:'200px',background:'linear-gradient(160deg,#1C1106,#0D0A04)'}}>
        <button onClick={()=>navigate('/attendees')} style={{position:'absolute',top:'16px',left:'16px',background:'rgba(13,10,4,.6)',backdropFilter:'blur(8px)',border:'1px solid var(--border-hi)',borderRadius:'8px',padding:'7px 14px',color:'var(--cream-mid)',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',fontFamily:'DM Sans'}}>
          <ArrowLeft size={13}/> Back
        </button>
        <div style={{position:'absolute',bottom:'-30px',left:'28px'}}>
          <div style={{width:'60px',height:'60px',borderRadius:'50%',background:'var(--bg-raised)',border:'3px solid var(--bg)',outline:'1px solid var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'26px',color:'var(--gold)'}}>
            {(profile.display_name||'?')[0].toUpperCase()}
          </div>
        </div>
      </div>
      <div style={{padding:'46px 28px 100px'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'8px'}}>
          <div style={{fontFamily:'Bebas Neue',fontSize:'30px',color:'var(--cream)',letterSpacing:'.02em',lineHeight:1}}>{profile.display_name}</div>
          {profile.tag&&<span style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--gold)',border:'1px solid rgba(200,144,48,.3)',padding:'4px 12px',borderRadius:'100px',letterSpacing:'.1em'}}>{profile.tag}</span>}
        </div>
        {profile.handle&&<div style={{fontFamily:'DM Mono',fontSize:'11px',color:'var(--cream-mid)',marginBottom:'20px'}}>{profile.handle} · Houston</div>}
        <div style={{height:'1px',background:'var(--border)',marginBottom:'20px'}}/>
        {profile.bio&&<p style={{fontSize:'14px',color:'var(--cream-mid)',lineHeight:1.7}}>{profile.bio}</p>}
        <div style={{marginTop:'28px',padding:'16px 18px',border:'1px solid var(--border-hi)',borderRadius:'12px',background:'var(--bg-card)',display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'var(--rust)',flexShrink:0}}/>
          <div>
            <div style={{fontFamily:'Bebas Neue',fontSize:'14px',color:'var(--cream)',letterSpacing:'.04em'}}>ATTENDING · RAN BY ARTISTS 002</div>
            <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',marginTop:'2px'}}>MAY 30, 2026</div>
          </div>
        </div>
      </div>
    </div>
  )
}
