import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function TestPurchase() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  const runTest = async () => {
    if (!user) { setStatus({ ok: false, msg: 'Sign in first' }); return }
    setLoading(true)
    setStatus(null)
    try {
      // Resolve the current published event so the test hits the real DB-driven contract.
      const { data: ev } = await supabase
        .from('events').select('slug').eq('status', 'published')
        .order('created_at', { ascending: false }).limit(1)
      const eventSlug = ev && ev[0] ? ev[0].slug : null
      if (!eventSlug) { setStatus({ ok: false, msg: 'No published event to test' }); setLoading(false); return }

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventSlug,
          tier: 'early-bird',
          email: user.email,
          userName: user.user_metadata?.full_name || '',
          userId: user.id,
        }),
      })
      const data = await res.json()
      if (data.url) {
        setStatus({ ok: true, msg: 'Redirecting to Stripe...' })
        window.location.href = data.url
      } else {
        setStatus({ ok: false, msg: data.error || 'Failed to create checkout session' })
      }
    } catch (err) {
      setStatus({ ok: false, msg: err.message })
    }
    setLoading(false)
  }

  return (
    <div style={{background:'#0A0A0D',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'28px'}}>
      <div style={{maxWidth:'400px',width:'100%',textAlign:'center'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'#83838F',letterSpacing:'.2em',marginBottom:'16px'}}>INTERNAL TEST ONLY</div>
        <div style={{fontFamily:'Bebas Neue',fontSize:'32px',color:'#F2EEE6',marginBottom:'8px'}}>END-TO-END TEST</div>
        <div style={{fontSize:'13px',color:'#C7C4BC',lineHeight:1.6,marginBottom:'32px'}}>
          This triggers a real $15 Stripe checkout in live mode. After payment, verify: ticket in Supabase, email in inbox, QR code works. Refund via Stripe dashboard after.
        </div>

        <button onClick={runTest} disabled={loading} style={{
          width:'100%',padding:'18px',borderRadius:'12px',border:'none',cursor:loading?'wait':'pointer',
          background:loading?'#1C1C22':'#F2EEE6',
          color:loading?'#C7C4BC':'#0A0A0D',
          fontFamily:'Bebas Neue',fontSize:'18px',letterSpacing:'.04em',
          display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',
        }}>
          {loading ? <><Loader2 size={18} style={{animation:'spin 1s linear infinite'}}/> PROCESSING...</> : 'PAY $15 — TEST PURCHASE'}
        </button>

        {status && (
          <div style={{marginTop:'20px',padding:'16px',borderRadius:'10px',background:status.ok?'rgba(199,201,209,.06)':'rgba(229,160,160,.06)',border:`1px solid ${status.ok?'rgba(199,201,209,.2)':'rgba(229,160,160,.2)'}`,display:'flex',alignItems:'center',gap:'10px',justifyContent:'center'}}>
            {status.ok ? <CheckCircle size={16} style={{color:'#C7C9D1'}}/> : <AlertCircle size={16} style={{color:'#E5A0A0'}}/>}
            <span style={{fontSize:'13px',color:status.ok?'#C7C9D1':'#E5A0A0'}}>{status.msg}</span>
          </div>
        )}

        <div style={{marginTop:'40px',fontSize:'11px',color:'#2C2C36'}}>
          Not linked from any public page. Remove after verification.
        </div>
      </div>
    </div>
  )
}
