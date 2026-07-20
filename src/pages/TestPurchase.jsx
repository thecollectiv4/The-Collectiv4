import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function TestPurchase() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  const runTest = async () => {
    if (authLoading) { setStatus({ ok: false, msg: 'Checking your session — try again in a second' }); return }
    if (!user) { setStatus({ ok: false, msg: 'Sign in first' }); return }
    setLoading(true)
    setStatus(null)
    try {
      // Hit the permanent, never-public QA event (migration 0012) so the checkout
      // runs end-to-end WITHOUT ever touching real production event data.
      const { data: ev } = await supabase
        .from('events').select('slug').eq('slug', 'qa-checkout-test').eq('is_test', true).maybeSingle()
      const eventSlug = ev?.slug || null
      if (!eventSlug) { setStatus({ ok: false, msg: 'QA test event missing — apply migration 0012' }); setLoading(false); return }

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventSlug,
          tier: 'test',
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
    <div style={{background:'var(--bg)',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'28px'}}>
      <div style={{maxWidth:'400px',width:'100%',textAlign:'center'}}>
        <div style={{fontFamily:'DM Mono',fontSize:'10px',color:'var(--cream-low)',letterSpacing:'.2em',marginBottom:'16px'}}>INTERNAL · TEST MODE</div>
        <div style={{fontFamily:'Bebas Neue',fontSize:'32px',color:'var(--cream)',marginBottom:'8px'}}>END-TO-END TEST</div>
        <div style={{fontSize:'13px',color:'var(--cream-mid)',lineHeight:1.6,marginBottom:'32px'}}>
          Runs a Stripe <strong>test-mode</strong> checkout against a hidden QA event — card 4242, $1 symbolic, <strong>no real money is charged</strong>. After payment, verify the ticket row, /claim, and the confirmation email.
        </div>

        <button onClick={runTest} disabled={loading} style={{
          width:'100%',padding:'18px',borderRadius:'12px',border:'none',cursor:loading?'wait':'pointer',
          background:loading?'var(--bg-raised)':'var(--cream)',
          color:loading?'var(--cream-mid)':'var(--bg)',
          fontFamily:'Bebas Neue',fontSize:'18px',letterSpacing:'.04em',
          display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',
        }}>
          {loading ? <><Loader2 size={18} style={{animation:'spin 1s linear infinite'}}/> PROCESSING...</> : 'RUN TEST CHECKOUT'}
        </button>

        {status && (
          <div style={{marginTop:'20px',padding:'16px',borderRadius:'10px',background:status.ok?'rgba(var(--silver-rgb),.06)':'rgba(229,160,160,.06)',border:`1px solid ${status.ok?'rgba(var(--silver-rgb),.2)':'rgba(229,160,160,.2)'}`,display:'flex',alignItems:'center',gap:'10px',justifyContent:'center'}}>
            {status.ok ? <CheckCircle size={16} style={{color:'var(--silver)'}}/> : <AlertCircle size={16} style={{color:'var(--warn)'}}/>}
            <span style={{fontSize:'13px',color:status.ok?'var(--silver)':'var(--warn)'}}>{status.msg}</span>
          </div>
        )}

        <div style={{marginTop:'40px',fontSize:'11px',color:'var(--cream-low)'}}>
          Hidden QA event · never shown publicly · session-gated.
        </div>
      </div>
    </div>
  )
}
