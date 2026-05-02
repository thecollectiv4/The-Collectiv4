import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { Lock, Sparkles } from 'lucide-react'

const SEED = [
  { id:'seed-pato',    name:'Pato Durán',       bio:'DJ & Founder, The Collectiv4', tag:'FOUNDER'  },
  { id:'seed-diego',   name:'Diego Villaseñor', bio:'Creative Director, Visurelic',  tag:'CREATIVE' },
  { id:'seed-marcus',  name:'Marcus Cole',      bio:'Producer & sound engineer',      tag:'MUSIC'    },
  { id:'seed-jasmine', name:'Jasmine Okafor',   bio:'Visual artist & muralist',       tag:'ART'      },
  { id:'seed-devon',   name:'Devon Mitchell',   bio:'House DJ, vinyl collector',       tag:'DJ'       },
  { id:'seed-sofia',   name:'Sofía Reyes',      bio:'Fashion designer',                tag:'FASHION'  },
  { id:'seed-andre',   name:'André Williams',   bio:'Photographer & filmmaker',        tag:'PHOTO'    },
  { id:'seed-lila',    name:'Lila Chen',         bio:'Gallery curator',                tag:'CURATOR'  },
  { id:'seed-carlos',  name:'Carlos Mendoza',   bio:'Graphic design & branding',       tag:'DESIGN'   },
  { id:'seed-amara',   name:'Amara Diallo',     bio:'Poet & creative director',        tag:'CREATIVE' },
]

export default function Attendees() {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!user) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 28px',textAlign:'center',background:'var(--bg)'}}>
      <Lock size={24} strokeWidth={1.2} style={{color:'var(--cream-low)',marginBottom:'20px'}}/>
      <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--cream)',letterSpacing:'.02em',marginBottom:'8px'}}>SEE WHO'S GOING</div>
      <div style={{fontSize:'13px',color:'var(--cream-low)',marginBottom:'28px',lineHeight:1.6}}>Create an account to see and connect with other attendees.</div>
      <button onClick={()=>navigate('/auth')} style={{background:'var(--cream)',border:'none',borderRadius:'10px',padding:'14px 36px',color:'var(--bg)',fontFamily:'DM Sans',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Join</button>
    </div>
  )

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh'}}>
      <div style={{padding:'20px 28px 16px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.3em',color:'var(--cream-low)',textTransform:'uppercase'}}>Ran By Artists · May 30</div>
        <div style={{fontFamily:'Bebas Neue',fontSize:'32px',color:'var(--cream)',letterSpacing:'.02em',marginTop:'6px'}}>WHO'S GOING</div>
        <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',marginTop:'6px',letterSpacing:'.06em'}}>{SEED.length} CONFIRMED</div>
      </div>
      <div style={{padding:'0 28px 100px'}}>
        {SEED.map((p,i)=>(
          <div key={i} onClick={()=>navigate(`/attendee/${p.id}`)}
            style={{display:'flex',alignItems:'center',gap:'14px',padding:'16px 0',borderBottom:i<SEED.length-1?'1px solid var(--border)':'none',cursor:'pointer',transition:'opacity .15s'}}
            onMouseOver={e=>e.currentTarget.style.opacity='.7'} onMouseOut={e=>e.currentTarget.style.opacity='1'}>
            <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'var(--bg-raised)',border:'1px solid var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'16px',color:'var(--gold)',flexShrink:0}}>
              {p.name[0]}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:'14px',fontWeight:500,color:'var(--cream)'}}>{p.name}</div>
              <div style={{fontSize:'11px',color:'var(--cream-low)',marginTop:'2px'}}>{p.bio}</div>
            </div>
            <span style={{fontFamily:'DM Mono',fontSize:'8px',letterSpacing:'.1em',color:'var(--cream-mid)',border:'1px solid var(--border-hi)',padding:'3px 10px',borderRadius:'100px',flexShrink:0}}>{p.tag}</span>
          </div>
        ))}
        <div style={{textAlign:'center',padding:'28px',marginTop:'16px',border:'1px solid var(--border)',borderRadius:'12px'}}>
          <Sparkles size={16} strokeWidth={1.2} style={{color:'var(--cream-low)',marginBottom:'8px'}}/>
          <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',letterSpacing:'.06em'}}>More joining every day</div>
        </div>
      </div>
    </div>
  )
}
