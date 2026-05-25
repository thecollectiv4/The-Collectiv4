import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { ArrowLeft, Camera, Keyboard, CheckCircle, XCircle, RotateCcw } from 'lucide-react'

export default function DoorScanner() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('camera')
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ total: 0, checkedIn: 0 })
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef(null)
  const html5QrRef = useRef(null)

  useEffect(() => {
    supabase.from('tickets').select('id,checked_in', { count: 'exact' }).eq('status', 'confirmed')
      .then(({ data, count }) => {
        const ci = data?.filter(t => t.checked_in).length || 0
        setStats({ total: count || 0, checkedIn: ci })
      })
  }, [])

  useEffect(() => {
    if (mode === 'camera' && !scanning) startCamera()
    return () => stopCamera()
  }, [mode])

  const startCamera = async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (html5QrRef.current) await html5QrRef.current.stop().catch(() => {})
      const scanner = new Html5Qrcode('qr-reader')
      html5QrRef.current = scanner
      setScanning(true)
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (text) => { scanner.stop().catch(() => {}); setScanning(false); handleScan(text) },
        () => {}
      )
    } catch (err) {
      console.log('Camera error:', err)
      setMode('manual')
    }
  }

  const stopCamera = () => {
    if (html5QrRef.current) html5QrRef.current.stop().catch(() => {})
    setScanning(false)
  }

  const handleScan = async (scannedCode) => {
    const cleaned = scannedCode.trim().toUpperCase()
    setCode(cleaned)
    await checkIn(cleaned)
  }

  const checkIn = async (qr) => {
    const checkCode = qr || code.trim().toUpperCase()
    if (!checkCode) return
    setLoading(true)
    setResult(null)
    const { data, error } = await supabase.from('tickets').select('*').eq('qr_code', checkCode).single()
    if (error || !data) {
      setResult({ ok: false, msg: 'Ticket not found', detail: 'Check the code and try again.' })
    } else if (data.checked_in) {
      setResult({ ok: false, msg: 'Already checked in', detail: `${data.buyer_name || 'This ticket'} was already scanned.`, ticket: data })
    } else {
      await supabase.from('tickets').update({ checked_in: true }).eq('id', data.id)
      setResult({ ok: true, msg: 'Welcome in!', detail: data.buyer_name || 'Attendee', ticket: data })
      setStats(s => ({ ...s, checkedIn: s.checkedIn + 1 }))
    }
    setLoading(false)
    setCode('')
  }

  const resetScan = () => {
    setResult(null)
    setCode('')
    if (mode === 'camera') startCamera()
  }

  if (!user) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}><div style={{ color: 'var(--cream-low)' }}>Sign in required</div></div>

  return (
    <div style={{ background: 'linear-gradient(180deg,#0E0D0C 0%,#0A0908 40%,#0A0908 100%)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--cream)', cursor: 'pointer' }}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: 'var(--cream)' }}>DOOR SCANNER</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', letterSpacing: '.1em' }}>RBA EDITION 002</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '0 28px 20px', display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'rgba(0,213,75,.04)', border: '1px solid rgba(0,213,75,.15)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '32px', color: '#00D54B' }}>{stats.checkedIn}</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', letterSpacing: '.08em' }}>CHECKED IN</div>
        </div>
        <div style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'rgba(242,230,208,.03)', border: '1px solid var(--border-hi)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '32px', color: 'var(--cream)' }}>{stats.total}</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', letterSpacing: '.08em' }}>TOTAL SOLD</div>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ padding: '0 28px 16px', display: 'flex', gap: '4px' }}>
        {[['camera', 'Camera', Camera], ['manual', 'Manual', Keyboard]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => { stopCamera(); setMode(id); setResult(null) }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: mode === id ? 'rgba(242,230,208,.08)' : 'transparent', color: mode === id ? 'var(--cream)' : 'var(--cream-low)', fontFamily: 'DM Sans', fontSize: '12px', fontWeight: 600, transition: 'all .2s' }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Scanner / Input */}
      <div style={{ padding: '0 28px 20px' }}>
        {mode === 'camera' && !result ? (
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-hi)', background: '#000' }}>
            <div id="qr-reader" style={{ width: '100%' }} />
            {!scanning && <div style={{ padding: '60px', textAlign: 'center', color: 'var(--cream-low)', fontSize: '12px' }}>Starting camera...</div>}
          </div>
        ) : mode === 'manual' && !result ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && checkIn()}
              placeholder="ENTER TICKET CODE"
              style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-hi)', borderRadius: '10px', padding: '16px', color: 'var(--cream)', fontFamily: 'DM Mono', fontSize: '14px', letterSpacing: '.06em', outline: 'none' }} />
            <button onClick={() => checkIn()} disabled={loading}
              style={{ width: '56px', borderRadius: '10px', background: 'var(--cream)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <CheckCircle size={18} style={{ color: 'var(--bg)' }} />
            </button>
          </div>
        ) : null}

        {/* Result */}
        {result && (
          <div style={{ animation: 'fadeUp .3s ease' }}>
            <div style={{ padding: '32px', borderRadius: '16px', border: `1px solid ${result.ok ? 'rgba(0,213,75,.3)' : 'rgba(220,38,38,.3)'}`, background: result.ok ? 'rgba(0,213,75,.06)' : 'rgba(220,38,38,.06)', textAlign: 'center' }}>
              {result.ok ? <CheckCircle size={48} style={{ color: '#00D54B', marginBottom: '16px' }} /> : <XCircle size={48} style={{ color: '#EF4444', marginBottom: '16px' }} />}
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: result.ok ? '#00D54B' : '#EF4444', marginBottom: '8px' }}>{result.msg}</div>
              <div style={{ fontSize: '16px', color: 'var(--cream)', marginBottom: '4px', fontWeight: 600 }}>{result.detail}</div>
              {result.ticket && <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-low)', marginTop: '8px' }}>{result.ticket.qr_code}</div>}
            </div>
            <button onClick={resetScan} style={{ width: '100%', marginTop: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(242,230,208,.06)', border: '1px solid var(--border-hi)', color: 'var(--cream)', fontFamily: 'DM Sans', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <RotateCcw size={14} /> Scan Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
