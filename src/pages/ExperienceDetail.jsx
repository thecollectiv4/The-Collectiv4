import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Ticket, Paintbrush, Frame, Shirt, Layers } from 'lucide-react'

const ICON_MAP = { Paintbrush, Frame, Shirt, Layers }

const EXPERIENCES = {
  'live-art': {
    label:'LIVE ART', iconName:'Paintbrush',
    color:'rgba(208,96,32,.12)', borderColor:'rgba(208,96,32,.35)', accent:'#D06020',
    gradient:'linear-gradient(160deg,#2A1408,#1A0A04,#0D0A04)',
    fullDesc:"Live painters take over the space as the night unfolds. You don't just see the finished work — you witness its creation. Each stroke synced to the music, each piece a permanent record of this specific night.",
    artistNote:"Drecol takes the stage as the live painter for Edition 002, creating work in real time as the music plays. Expect raw, expressive work — nothing cleaned up for a gallery.",
    details:["Original work created live during the event","All pieces available for purchase on the night","Artists present to talk about their work"],
    artists:[
      { name:'Drecol', slug:'drecol', role:'Live Painter · Featured Artist', desc:'Painting live as the music plays. Each piece is a one-of-one record of the night — created in the room, in the moment.' },
    ],
  },
  'gallery': {
    label:'GALLERY', iconName:'Frame',
    color:'rgba(138,32,64,.1)', borderColor:'rgba(138,32,64,.3)', accent:'#8A2040',
    gradient:'linear-gradient(160deg,#1A0A14,#120810,#0D0A04)',
    fullDesc:"A curated selection of original works on display throughout the venue. Not behind glass — in the room with you. Art that lives in the same space as the music and the people.",
    artistNote:"Each piece was selected to reflect the energy of this edition. The gallery is a living part of the event — walk through it, talk about it, feel it.",
    details:["Curated original works on display","Art available for purchase","Meet the artists in person","Pieces created specifically for this edition"],
    artists:[
      { name:'Isaac Lagarda', slug:'isaac-lagarda', role:'Painter · Featured Artist', desc:'Visual storyteller bringing raw emotion to canvas. His work anchors the gallery for Edition 002.' },
      { name:'Drecol', slug:'drecol', role:'Painter · Featured Artist', desc:'Live painter and visual artist. His pieces capture the energy of the night in real time — raw, unfiltered, alive.' },
      { name:'Pato Durán', slug:'pato-duran', role:'Founder · DJ · Creative Director', desc:'Founder of The Collectiv4. Curating the visual identity and spatial design of the gallery experience.' },
      { name:'Diego Villaseñor', slug:'diego-villasenor', role:'Founder · Artist · Creative Director', desc:'Founder of The Collectiv4. Visual artist and creative director shaping the collective\'s identity and experience.' },
    ],
  },
  'fashion': {
    label:'FASHION POP-UP', iconName:'Shirt',
    color:'rgba(212,160,64,.08)', borderColor:'rgba(212,160,64,.25)', accent:'#D4A040',
    gradient:'linear-gradient(160deg,#1A1408,#141004,#0D0A04)',
    fullDesc:"A curated selection of Houston's most compelling fashion voices. Independent designers, emerging brands, and makers who turn fabric into identity. Not a mall — a living fashion gallery.",
    artistNote:"Each brand at the pop-up was personally invited. The selection reflects Houston's creative scene: diverse, authentic, and impossible to find anywhere else in one room.",
    details:["Houston-based designers only","Limited and exclusive pieces","Direct from the makers — no middlemen","Collab merch with RBA branding available"],
  },
  'screen-printing': {
    label:'SCREEN PRINTING', iconName:'Layers',
    color:'rgba(90,122,58,.1)', borderColor:'rgba(90,122,58,.3)', accent:'#5A9A30',
    gradient:'linear-gradient(160deg,#0C1A08,#0A1204,#0D0A04)',
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

  const IconComp = ICON_MAP[exp.iconName]

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh'}}>
      <div style={{position:'relative',height:'240px',background:exp.gradient,overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,background:exp.color}}/>
        <div style={{position:'absolute',bottom:'-60px',right:'-30px',width:'200px',height:'200px',borderRadius:'50%',background:`radial-gradient(circle,${exp.accent}22 0%,transparent 70%)`,filter:'blur(60px)'}} />
        <button onClick={()=>navigate('/')} style={{position:'absolute',top:'16px',left:'16px',background:'rgba(13,10,4,.6)',backdropFilter:'blur(8px)',border:'1px solid var(--border-hi)',borderRadius:'8px',padding:'7px 14px',color:'var(--cream-mid)',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',fontFamily:'DM Sans'}}>
          <ArrowLeft size={13}/> Back
        </button>
        <div style={{position:'absolute',bottom:'28px',left:'28px',display:'flex',alignItems:'flex-end',gap:'16px'}}>
          <div style={{width:'56px',height:'56px',borderRadius:'14px',background:exp.color,border:`1px solid ${exp.borderColor}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <IconComp size={28} strokeWidth={1.4} style={{color:exp.accent}} />
          </div>
          <div>
            <div style={{fontFamily:'Bebas Neue',fontSize:'36px',color:'var(--cream)',letterSpacing:'.02em',lineHeight:1}}>{exp.label}</div>
            <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',marginTop:'4px',letterSpacing:'.15em'}}>RAN BY ARTISTS 002 · MAY 30</div>
          </div>
        </div>
      </div>

      <div style={{padding:'32px 28px 120px'}}>
        <p style={{fontSize:'15px',color:'var(--cream-mid)',lineHeight:1.75,marginBottom:'28px'}}>{exp.fullDesc}</p>
        <div style={{height:'1px',background:'var(--border)',marginBottom:'28px'}}/>

        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.2em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'16px'}}>WHAT TO EXPECT</div>
        <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'32px'}}>
          {exp.details.map((d,i)=>(
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:'12px'}}>
              <div style={{width:'6px',height:'6px',borderRadius:'50%',background:exp.accent,marginTop:'7px',flexShrink:0}}/>
              <div style={{fontSize:'13px',color:'var(--cream-mid)',lineHeight:1.5}}>{d}</div>
            </div>
          ))}
        </div>

        {exp.artists && (
          <>
            <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.2em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'16px'}}>FEATURED ARTISTS</div>
            <div style={{display:'flex',flexDirection:'column',gap:'12px',marginBottom:'32px'}}>
              {exp.artists.map((a,i)=>(
                <div key={i} onClick={()=>a.slug&&navigate('/artist/'+a.slug)} style={{padding:'16px',border:`1px solid ${exp.borderColor}`,borderRadius:'12px',background:exp.color,cursor:a.slug?'pointer':'default',transition:'all .2s'}}
                  onMouseOver={e=>{if(a.slug){e.currentTarget.style.borderColor=exp.accent;e.currentTarget.style.transform='translateX(4px)'}}} onMouseOut={e=>{if(a.slug){e.currentTarget.style.borderColor=exp.borderColor;e.currentTarget.style.transform='translateX(0)'}}}>
                  <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'8px'}}>
                    <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'var(--bg-raised)',border:`1px solid ${exp.borderColor}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bebas Neue',fontSize:'15px',color:exp.accent}}>{a.name[0]}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'14px',fontWeight:600,color:'var(--cream)'}}>{a.name}</div>
                      <div style={{fontFamily:'DM Mono',fontSize:'9px',color:exp.accent,letterSpacing:'.04em',marginTop:'1px'}}>{a.role}</div>
                    </div>
                    {a.slug && <ArrowLeft size={14} style={{color:'var(--cream-low)',transform:'rotate(180deg)'}} />}
                  </div>
                  <div style={{fontSize:'12px',color:'var(--cream-mid)',lineHeight:1.5}}>{a.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{padding:'20px',border:`1px solid ${exp.borderColor}`,borderRadius:'12px',background:exp.color,marginBottom:'32px'}}>
          <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.15em',color:'var(--cream-low)',textTransform:'uppercase',marginBottom:'10px'}}>FROM THE ARTIST</div>
          <p style={{fontSize:'13px',color:'var(--cream-mid)',lineHeight:1.65,fontStyle:'italic'}}>{exp.artistNote}</p>
        </div>

        <button onClick={()=>navigate('/')} style={{width:'100%',background:'var(--cream)',border:'none',borderRadius:'12px',padding:'16px',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',cursor:'pointer'}}>
          <Ticket size={16} style={{color:'var(--bg)'}}/>
          <span style={{fontFamily:'Bebas Neue',fontSize:'17px',color:'var(--bg)',letterSpacing:'.06em'}}>GET YOUR TICKET — FROM $15</span>
        </button>
      </div>
    </div>
  )
}
