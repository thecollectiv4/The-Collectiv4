import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Ticket } from 'lucide-react'

const EXPERIENCES = {
  'live-art': {
    label:'LIVE ART', icon:'🎨', color:'rgba(200,90,24,.1)', borderColor:'rgba(200,90,24,.3)',
    fullDesc:"Live painters take over the space as the night unfolds. You don't just see the finished work — you witness its creation. Each stroke synced to the music, each piece a permanent record of this specific night.",
    artistNote:"Houston-based visual artists will be on-site throughout the evening creating new work. Their pieces will be available for purchase directly at the event. Expect raw, expressive work — nothing cleaned up for a gallery.",
    details:["Original work created live during the event","All pieces available for purchase on the night","Artists present to talk about their work","Multiple artists working simultaneously"],
  },
  'fashion': {
    label:'FASHION POP-UP', icon:'👗', color:'rgba(200,144,48,.08)', borderColor:'rgba(200,144,48,.25)',
    fullDesc:"A curated selection of Houston's most compelling fashion voices. Independent designers, emerging brands, and makers who turn fabric into identity. Not a mall — a living fashion gallery.",
    artistNote:"Each brand at the pop-up was personally invited. The selection reflects Houston's creative scene: diverse, authentic, and impossible to find anywhere else in one room.",
    details:["Houston-based designers only","Limited and exclusive pieces","Direct from the makers — no middlemen","Collab merch with RBA branding available"],
  },
  'screen-printing': {
    label:'SCREEN PRINTING', icon:'🖨️', color:'rgba(74,90,56,.1)', borderColor:'rgba(74,90,56,.3)',
    fullDesc:"A live screen printing station producing exclusive RBA Edition 002 merch in real time. Watch the process, choose your design, wear it out. Collab pieces from Houston artists — made that night, not before.",
    artistNote:"Designed in collaboration with Houston artists for this edition only. Once the supply runs out, the design is gone. No restocks. No online store. If you're there, you can have it.",
    details:["Printed live on-site","Limited quantities — first come, first served","RBA 002 exclusive designs","Collab artist pieces available"],
  },
}

export default function ExperienceDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const exp = EXPERIENCES[slug]
  if (!exp) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}><div style={{fontSize:'13px',color:'var(--cream-low)'}}>Not found</div></div>

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh'}}>
      <div style={{position:'relative',height:'220px',background:'linear-gradient(160deg,#1C1106,#0D0A04)',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,background:exp.color}}/>
        <button onClick={()=>navigate('/')} style={{position:'absolute',top:'16px',left:'16px',background:'rgba(13,10,4,.6)',backdropFilter:'blur(8px)',border:'1px solid var(--border-hi)',borderRadius:'8px',padding:'7px 14px',color:'var(--cream-mid)',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',fontFamily:'DM Sans'}}>
          <ArrowLeft size={13}/> Back
        </button>
        <div style={{position:'absolute',bottom:'28px',left:'28px'}}>
          <span style={{fontSize:'40px'}}>{exp.icon}</span>
          <div style={{fontFamily:'Bebas Neue',fontSize:'36px',color:'var(--cream)',letterSpacing:'.02em',lineHeight:1,marginTop:'8px'}}>{exp.label}</div>
          <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'4px',letterSpacing:'.15em'}}>RAN BY ARTISTS 002 · MAY 30</div>
        </div>
      </div>

      <div style={{padding:'32px 28px 100px'}}>
        <p style={{fontSize:'15px',color:'var(--cream-mid)',lineHeight:1.75,marginBottom:'28px'}}>{exp.fullDesc}</p>
        <div style={{height:'1px',background:'var(--border)',marginBottom:'28px'}}/>

        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.2em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'16px'}}>WHAT TO EXPECT</div>
        <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'32px'}}>
          {exp.details.map((d,i)=>(
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:'12px'}}>
              <div style={{width:'5px',height:'5px',borderRadius:'50%',background:'var(--rust)',marginTop:'7px',flexShrink:0}}/>
              <div style={{fontSize:'13px',color:'var(--cream-mid)',lineHeight:1.5}}>{d}</div>
            </div>
          ))}
        </div>

        <div style={{padding:'20px',border:`1px solid ${exp.borderColor}`,borderRadius:'12px',background:exp.color,marginBottom:'32px'}}>
          <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.15em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'10px'}}>FROM THE ARTIST</div>
          <p style={{fontSize:'13px',color:'var(--cream-mid)',lineHeight:1.65,fontStyle:'italic'}}>{exp.artistNote}</p>
        </div>

        <button onClick={()=>navigate('/auth')} style={{width:'100%',background:'var(--cream)',border:'none',borderRadius:'12px',padding:'16px',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',cursor:'pointer'}}>
          <Ticket size={16} style={{color:'var(--bg)'}}/>
          <span style={{fontFamily:'Bebas Neue',fontSize:'17px',color:'var(--bg)',letterSpacing:'.06em'}}>GET YOUR TICKET — FROM $15</span>
        </button>
      </div>
    </div>
  )
}
