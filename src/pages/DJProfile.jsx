import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Instagram, Music } from 'lucide-react'

const DJS = {
  madou: {
    name: 'MADOU', ig: '@natemadou', role: 'DJ · Producer', location: 'Houston, TX',
    tag: 'House · Deep House',
    bio: "Houston-rooted selector. Deep, hypnotic grooves built for rooms that feel alive. Madou reads crowds like poetry — pulling listeners into layered, soulful house that doesn't just make you move, it makes you feel.",
    details: "A founding collaborator of The Collectiv4 and one of Houston's most compelling voices in house and deep house. Known for sets that build slowly and pay off completely.",
    sets: ['Deep House', 'Afro House', 'Organic House'],
  },
  patoduranc: {
    name: 'PATO', ig: '@patoduranc', role: 'DJ · Founder', location: 'Houston, TX',
    tag: 'House · Techno',
    bio: "DJ and founder of The Collectiv4 — a creative ecosystem built at the intersection of music, art, and community. Behind the decks and behind the vision.",
    details: "Patricio Durán Chacón has been building Houston's creative infrastructure through Ran By Artists events, The Collectiv4 platform, and a DJ practice that spans house and techno. When he plays, he plays for the room — not for the clip.",
    sets: ['House', 'Techno', 'Minimal'],
  }
}

export default function DJProfile() {
  const { handle } = useParams()
  const navigate = useNavigate()
  const dj = DJS[handle]

  if (!dj) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
      <div style={{fontSize:'13px',color:'var(--cream-low)'}}>Artist not found</div>
    </div>
  )

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh'}}>
      {/* Hero */}
      <div style={{position:'relative',height:'300px',overflow:'hidden',background:'linear-gradient(160deg,#1C1106,#0D0A04 50%,#14100A)'}}>
        <div style={{position:'absolute',bottom:'-40px',left:'30%',width:'240px',height:'240px',borderRadius:'50%',background:'radial-gradient(circle,rgba(200,144,48,.12) 0%,transparent 70%)',filter:'blur(80px)'}}/>
        <div style={{position:'absolute',inset:0,opacity:.05,backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`}}/>
        <button onClick={()=>navigate('/')} style={{position:'absolute',top:'16px',left:'16px',background:'rgba(13,10,4,.6)',backdropFilter:'blur(8px)',border:'1px solid var(--border-hi)',borderRadius:'8px',padding:'7px 14px',color:'var(--cream-mid)',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',fontFamily:'DM Sans'}}>
          <ArrowLeft size={13}/> Back
        </button>
        {/* Avatar */}
        <div style={{position:'absolute',bottom:'-36px',left:'28px'}}>
          <div style={{width:'72px',height:'72px',borderRadius:'50%',background:'var(--bg-raised)',border:'3px solid var(--bg)',outline:'1px solid var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'30px',color:'var(--gold)'}}>
            {dj.name[0]}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{padding:'52px 28px 100px'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'16px'}}>
          <div>
            <div style={{fontFamily:'Bebas Neue',fontSize:'36px',color:'var(--cream)',letterSpacing:'.02em',lineHeight:1}}>{dj.name}</div>
            <div style={{fontFamily:'DM Mono',fontSize:'11px',color:'var(--cream-mid)',marginTop:'4px',letterSpacing:'.04em'}}>{dj.ig} · {dj.location}</div>
          </div>
          <div style={{border:'1px solid rgba(200,90,24,.3)',borderRadius:'100px',padding:'5px 14px',fontFamily:'DM Mono',fontSize:'9px',color:'var(--rust)',letterSpacing:'.1em'}}>{dj.role}</div>
        </div>

        {/* Tag chips */}
        <div style={{display:'flex',gap:'8px',marginBottom:'24px',flexWrap:'wrap'}}>
          {dj.sets.map((s,i)=>(
            <span key={i} style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.08em',color:'var(--cream-mid)',border:'1px solid var(--border-hi)',padding:'4px 12px',borderRadius:'100px'}}>{s}</span>
          ))}
        </div>

        <div style={{height:'1px',background:'var(--border)',marginBottom:'24px'}}/>

        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.2em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'12px'}}>ABOUT</div>
        <p style={{fontSize:'14px',color:'var(--cream-mid)',lineHeight:1.7,marginBottom:'16px'}}>{dj.bio}</p>
        <p style={{fontSize:'13px',color:'var(--cream-low)',lineHeight:1.7}}>{dj.details}</p>

        {/* RBA badge */}
        <div style={{marginTop:'32px',padding:'20px',border:'1px solid var(--border-hi)',borderRadius:'12px',background:'var(--bg-card)'}}>
          <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.15em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'8px'}}>PERFORMING AT</div>
          <div style={{fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--cream)',letterSpacing:'.02em'}}>RAN BY ARTISTS 002</div>
          <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-mid)',marginTop:'4px'}}>MAY 30, 2026 · HOUSTON</div>
          <button onClick={()=>navigate('/')} style={{marginTop:'16px',background:'var(--cream)',border:'none',borderRadius:'10px',padding:'12px 24px',color:'var(--bg)',fontFamily:'Bebas Neue',fontSize:'15px',letterSpacing:'.06em',cursor:'pointer'}}>
            GET TICKET
          </button>
        </div>
      </div>
    </div>
  )
}
