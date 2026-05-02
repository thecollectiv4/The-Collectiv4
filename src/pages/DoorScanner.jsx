import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { ArrowLeft, ScanLine, Check, X, Search } from 'lucide-react'

export default function DoorScanner() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null) // {status, ticket}
  const [loading, setLoading] = useState(false)

  const checkIn = async () => {
    if (!code.trim()) return
    setLoading(true); setResult(null)
    try {
      const { data, error } = await supabase.from('tickets')
        .select('*').eq('qr_code', code.trim().toUpperCase()).single()

      if (error || !data) {
        setResult({ status: 'not_found' })
      } else if (data.checked_in) {
        setResult({ status: 'already', ticket: data })
      } else {
        await supabase.from('tickets').update({ checked_in: true }).eq('id', data.id)
        setResult({ status: 'success', ticket: data })
      }
    } catch (err) {
      setResult({ status: 'error' })
    }
    setLoading(false)
  }

  return (
    <div style={{background:'linear-gradient(180deg,#0E0D0C 0%,#0A0908 40%,#0A0908 100%)',minHeight:'100vh',padding:'20px 28px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'32px'}}>
        <button onClick={()=>navigate('/')} style={{background:'none',border:'none',color:'var(--cream)',cursor:'pointer'}}><ArrowLeft size={18}/></button>
        <div>
          <div style={{fontFamily:'Bebas Neue',fontSize:'24px',color:'var(--cream)'}}>DOOR SCANNER</div>
          <div style={{fontFamily:'DM Mono',fontSize:'9px',color:'var(--cream-low)',letterSpacing:'.1em'}}>RBA EDITION 002 · STAFF ONLY</div>
        </div>
      </div>

      {/* Manual code entry */}
      <div style={{marginBottom:'24px'}}>
        <label style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.2em',color:'var(--cream-low)',marginBottom:'8px',display:'block'}}>ENTER QR CODE</label>
        <div style={{display:'flex',gap:'8px'}}>
          <input type="text" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="RBA2-XXXXXX-XXXXXX"
            onKeyDown={e=>e.key==='Enter'&&checkIn()}
            style={{flex:1,background:'var(--bg-card)',border:'1px solid var(--border-hi)',borderRadius:'10px',padding:'14px 16px',color:'var(--cream)',fontFamily:'DM Mono',fontSize:'14px',outline:'none',letterSpacing:'.04em',transition:'border-color .2s'}}
          />
          <button onClick={checkIn} disabled={loading}
            style={{background:'var(--cream)',border:'none',borderRadius:'10px',padding:'14px 20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}}
            onMouseOver={e=>{e.currentTarget.style.transform='translateY(-1px)'}} onMouseOut={e=>{e.currentTarget.style.transform='translateY(0)'}}>
            {loading ? <div style={{width:'16px',height:'16px',border:'2px solid var(--bg)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin .6s linear infinite'}}/> : <Search size={16} style={{color:'var(--bg)'}}/>}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div style={{borderRadius:'14px',overflow:'hidden',marginBottom:'24px',animation:'fadeUp .3s ease'}}>
          {result.status === 'success' && (
            <div style={{padding:'28px',background:'rgba(0,213,75,.06)',border:'1px solid rgba(0,213,75,.25)',borderRadius:'14px',textAlign:'center'}}>
              <div style={{width:'56px',height:'56px',borderRadius:'50%',background:'rgba(0,213,75,.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
                <Check size={28} style={{color:'#00D54B'}} />
              </div>
              <div style={{fontFamily:'Bebas Neue',fontSize:'28px',color:'#00D54B',marginBottom:'4px'}}>CHECKED IN</div>
              <div style={{fontFamily:'DM Mono',fontSize:'11px',color:'var(--cream-mid)',marginBottom:'12px'}}>{result.ticket.email}</div>
              <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)'}}>{result.ticket.tier?.toUpperCase()} · {result.ticket.qr_code}</div>
            </div>
          )}
          {result.status === 'already' && (
            <div style={{padding:'28px',background:'rgba(255,180,50,.06)',border:'1px solid rgba(255,180,50,.25)',borderRadius:'14px',textAlign:'center'}}>
              <div style={{fontFamily:'Bebas Neue',fontSize:'24px',color:'#FFB432',marginBottom:'8px'}}>ALREADY CHECKED IN</div>
              <div style={{fontFamily:'DM Mono',fontSize:'11px',color:'var(--cream-mid)'}}>{result.ticket.email}</div>
              <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',marginTop:'6px'}}>This ticket was already scanned</div>
            </div>
          )}
          {result.status === 'not_found' && (
            <div style={{padding:'28px',background:'rgba(220,38,38,.06)',border:'1px solid rgba(220,38,38,.25)',borderRadius:'14px',textAlign:'center'}}>
              <div style={{width:'56px',height:'56px',borderRadius:'50%',background:'rgba(220,38,38,.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
                <X size={28} style={{color:'#EF4444'}} />
              </div>
              <div style={{fontFamily:'Bebas Neue',fontSize:'24px',color:'#EF4444',marginBottom:'8px'}}>NOT FOUND</div>
              <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)'}}>No ticket matches this code</div>
            </div>
          )}
          {result.status === 'error' && (
            <div style={{padding:'20px',background:'rgba(220,38,38,.06)',border:'1px solid rgba(220,38,38,.2)',borderRadius:'14px',textAlign:'center'}}>
              <div style={{fontFamily:'DM Mono',fontSize:'11px',color:'#EF4444'}}>Connection error. Try again.</div>
            </div>
          )}
        </div>
      )}

      {/* Scan another */}
      {result && (
        <button onClick={()=>{setCode('');setResult(null)}}
          style={{width:'100%',background:'rgba(242,230,208,.06)',border:'1px solid rgba(242,230,208,.12)',borderRadius:'10px',padding:'14px',color:'var(--cream)',fontFamily:'DM Sans',fontSize:'13px',cursor:'pointer',transition:'all .2s'}}
          onMouseOver={e=>{e.currentTarget.style.background='rgba(242,230,208,.1)'}} onMouseOut={e=>{e.currentTarget.style.background='rgba(242,230,208,.06)'}}>
          Scan Another
        </button>
      )}

      {/* Quick info */}
      <div style={{marginTop:'32px',padding:'20px',border:'1px solid var(--border)',borderRadius:'12px'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.15em',color:'var(--cream-low)',marginBottom:'12px'}}>HOW TO USE</div>
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {['Ask attendee to show QR code on their phone','Type the code below the QR (starts with RBA2-)','Green = let them in · Yellow = already scanned · Red = invalid'].map((s,i)=>(
            <div key={i} style={{display:'flex',gap:'10px',alignItems:'flex-start'}}>
              <span style={{fontFamily:'DM Mono',fontSize:'11px',color:'var(--cream-low)',flexShrink:0}}>{i+1}.</span>
              <span style={{fontSize:'12px',color:'var(--cream-mid)',lineHeight:1.5}}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
