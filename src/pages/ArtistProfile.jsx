import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Instagram, ExternalLink, Award } from 'lucide-react'

const ARTISTS = {
  'isaac-lagarda': {
    name: 'ISAAC LAGARDA',
    role: 'Painter · Visual Artist',
    location: 'Houston, TX',
    bio: "Visual storyteller bringing raw emotion to canvas. Isaac's work lives at the intersection of street culture and fine art — bold, unapologetic, and deeply personal. His pieces anchor the gallery for Ran By Artists Edition 002.",
    contributions: ['Gallery Featured Artist — RBA 002', 'Flyer design — Edition 001 & 002', 'Original paintings on display and for sale'],
    initial: 'I',
    accent: '#8A2040',
  },
  'drecol': {
    name: 'DRECOL',
    role: 'Live Painter · Visual Artist',
    location: 'Houston, TX',
    bio: "Drecol paints live as the music plays — each piece a one-of-one record of the night. His process is raw and immediate, creating work that captures the energy of the room in real time. No sketches, no prep — just paint and presence.",
    contributions: ['Live Painter — RBA 002', 'Gallery Featured Artist — RBA 002', 'Original live-painted pieces available for purchase'],
    initial: 'D',
    accent: '#D06020',
  },
  'pato-duran': {
    name: 'PATO DURÁN',
    ig: '@patoduranc',
    role: 'Founder · DJ · Creative Director',
    location: 'Houston, TX',
    bio: "House and techno DJ. Founder of The Collectiv4 and the creative force behind Ran By Artists. From the decks to the big picture — music, venues, brand, platform.",
    contributions: ['Founder — The Collectiv4', 'DJ — RBA Edition 001 & 002', 'Creative Direction — Events & Platform'],
    initial: 'P',
    accent: '#FFFFFF',
  },
  'diego-villasenor': {
    name: 'DIEGO VILLASEÑOR',
    ig: '@visurelic',
    role: 'Founder · Artist · Creative Director',
    location: 'Houston, TX / Valencia, Spain',
    bio: "Founder of The Collectiv4. Visual artist and creative director behind the collective's identity. Brand, media, content, event design — nothing goes out without his eye on it.",
    contributions: ['Founder — The Collectiv4', 'Visual & Creative Direction', 'Artist — Digital & Mixed Media', 'European Expansion — Long-term Vision'],
    initial: 'D',
    accent: '#D4A040',
  },
  'madou': {
    name: 'MADOU',
    ig: '@natemadou',
    role: 'DJ · Producer',
    location: 'Houston, TX',
    bio: "Houston-rooted selector. Deep, hypnotic grooves built for rooms that feel alive. Madou reads crowds like poetry — pulling listeners into layered, soulful house that doesn't just make you move, it makes you feel.",
    contributions: ['DJ Set — RBA Edition 001 & 002', 'Founding collaborator — The Collectiv4', 'Deep House · Afro House · Organic House'],
    initial: 'M',
    accent: '#5A9A30',
  },
}

export default function ArtistProfile() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const artist = ARTISTS[slug]

  if (!artist) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
      <div style={{fontSize:'13px',color:'var(--cream-low)'}}>Artist not found</div>
    </div>
  )

  return (
    <div style={{background:'linear-gradient(180deg,#0E0D0C 0%,#0B0A09 30%,#0A0908 100%)',minHeight:'100vh'}}>
      {/* Header */}
      <div style={{position:'sticky',top:0,zIndex:50,background:'rgba(13,10,4,.92)',backdropFilter:'blur(16px)',borderBottom:'1px solid var(--border-hi)',padding:'12px 28px',display:'flex',alignItems:'center',gap:'12px'}}>
        <button onClick={()=>navigate(-1)} style={{background:'none',border:'none',color:'var(--cream)',cursor:'pointer',display:'flex',alignItems:'center'}}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{fontFamily:'Bebas Neue',fontSize:'16px',color:'var(--cream)',letterSpacing:'.06em'}}>ARTIST</div>
      </div>

      {/* Hero */}
      <div style={{padding:'40px 28px 32px',textAlign:'center',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'0',left:'50%',transform:'translateX(-50%)',width:'300px',height:'300px',borderRadius:'50%',background:`radial-gradient(circle,${artist.accent}15 0%,transparent 70%)`,filter:'blur(60px)'}} />
        <div style={{position:'relative',zIndex:2}}>
          <div style={{width:'90px',height:'90px',borderRadius:'50%',background:'var(--bg-raised)',border:`2px solid ${artist.accent}40`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'38px',color:artist.accent,margin:'0 auto 16px',boxShadow:`0 0 24px ${artist.accent}15`}}>
            {artist.initial}
          </div>
          <div style={{fontFamily:'Bebas Neue',fontSize:'32px',color:'var(--cream)',letterSpacing:'.02em',lineHeight:1}}>{artist.name}</div>
          <div style={{fontFamily:'DM Mono',fontSize:'10px',color:artist.accent,letterSpacing:'.06em',marginTop:'8px'}}>{artist.role}</div>
          <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',marginTop:'4px',letterSpacing:'.04em'}}>{artist.location}</div>
          {artist.ig && (
            <div style={{marginTop:'12px',display:'inline-flex',alignItems:'center',gap:'6px',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:'100px',padding:'6px 14px',fontSize:'11px',color:'var(--cream-mid)'}}>
              <Instagram size={12}/> {artist.ig}
            </div>
          )}
        </div>
      </div>

      <div style={{padding:'0 28px 100px'}}>
        {/* Bio */}
        <p style={{fontSize:'14px',color:'var(--cream-mid)',lineHeight:1.7,marginBottom:'28px'}}>{artist.bio}</p>

        <div style={{height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent)',marginBottom:'28px'}} />

        {/* Contributions */}
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.2em',color:'var(--cream)',marginBottom:'16px'}}>CONTRIBUTIONS</div>
        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'32px'}}>
          {artist.contributions.map((c,i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',borderRadius:'10px',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)'}}>
              <Award size={14} strokeWidth={1.4} style={{color:artist.accent,flexShrink:0}} />
              <span style={{fontSize:'12px',color:'var(--cream-mid)'}}>{c}</span>
            </div>
          ))}
        </div>

        {/* Back to event */}
        <button onClick={()=>navigate('/')} style={{width:'100%',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:'12px',padding:'14px',color:'var(--cream)',fontFamily:'DM Sans',fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',transition:'all .2s'}}
          onMouseOver={e=>{e.currentTarget.style.background='rgba(255,255,255,.1)'}} onMouseOut={e=>{e.currentTarget.style.background='rgba(255,255,255,.06)'}}>
          <ExternalLink size={14}/> Back to Event
        </button>
      </div>
    </div>
  )
}
