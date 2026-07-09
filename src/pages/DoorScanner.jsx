import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/api/supabase'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { ArrowLeft, Camera, Keyboard, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import AuthResolving from '@/components/AuthResolving'

export default function DoorScanner() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const live = useLiveEvent()
  const [mode, setMode] = useState('camera')
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ total: 0, checkedIn: 0 })
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef(null)
  const html5QrRef = useRef(null)

  useEffect(() => {
    // PII-free counts via SECURITY DEFINER RPC (tickets are no longer client-readable).
    supabase.rpc('door_stats').then(({ data }) => {
      if (data) setStats({ total: data.confirmed || 0, checkedIn: data.checked_in || 0 })
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
    // Atomic server-side check-in: flips checked_in + reports outcome. Returns
    // only door-safe fields (status + display name), never PII/payment.
    const { data, error } = await supabase.rpc('check_in_ticket', { p_qr: checkCode })
    const r = data || {}
    if (error || r.status === 'denied') {
      setResult({ ok: false, msg: 'Not authorized', detail: 'Sign in as door staff to scan.' })
    } else if (r.status === 'not_found') {
      setResult({ ok: false, msg: 'Ticket not found', detail: 'Check the code and try again.', ticket: { qr_code: checkCode } })
    } else if (r.status === 'already_in') {
      setResult({ ok: false, msg: 'Already checked in', detail: `${r.name || 'This ticket'} was already scanned.`, ticket: { qr_code: checkCode } })
    } else {
      setResult({ ok: true, msg: 'Welcome in!', detail: r.name || 'Attendee', ticket: { qr_code: checkCode } })
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

  // Session still rehydrating — never flash "Sign in required" at signed-in door staff.
  if (authLoading) return <AuthResolving />

  if (!user) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}><div style={{ color: 'var(--cream-low)' }}>Sign in required</div></div>

  return (
    <div style={{ background: 'linear-gradient(180deg,#0A0A0D 0%,#0A0A0D 40%,#0A0A0D 100%)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--cream)', cursor: 'pointer' }}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: 'var(--cream)' }}>DOOR SCANNER</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', letterSpacing: '.1em' }}>{live.edition ? `RBA ${live.edition}` : 'RBA'}</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '0 28px 20px', display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'rgba(199,201,209,.04)', border: '1px solid rgba(199,201,209,.15)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '32px', color: '#C7C9D1' }}>{stats.checkedIn}</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', letterSpacing: '.08em' }}>CHECKED IN</div>
        </div>
        <div style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'rgba(242,238,230,.03)', border: '1px solid var(--border-hi)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '32px', color: 'var(--cream)' }}>{stats.total}</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: 'var(--cream-low)', letterSpacing: '.08em' }}>TOTAL SOLD</div>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ padding: '0 28px 16px', display: 'flex', gap: '4px' }}>
        {[['camera', 'Camera', Camera], ['manual', 'Manual', Keyboard]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => { stopCamera(); setMode(id); setResult(null) }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: mode === id ? 'rgba(242,238,230,.08)' : 'transparent', color: mode === id ? 'var(--cream)' : 'var(--cream-low)', fontFamily: 'DM Sans', fontSize: '12px', fontWeight: 600, transition: 'all .2s' }}>
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
            <div style={{ padding: '32px', borderRadius: '16px', border: `1px solid ${result.ok ? 'rgba(199,201,209,.3)' : 'rgba(229,160,160,.3)'}`, background: result.ok ? 'rgba(199,201,209,.06)' : 'rgba(229,160,160,.06)', textAlign: 'center' }}>
              {result.ok ? <CheckCircle size={48} style={{ color: '#C7C9D1', marginBottom: '16px' }} /> : <XCircle size={48} style={{ color: '#E5A0A0', marginBottom: '16px' }} />}
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: result.ok ? '#C7C9D1' : '#E5A0A0', marginBottom: '8px' }}>{result.msg}</div>
              <div style={{ fontSize: '16px', color: 'var(--cream)', marginBottom: '4px', fontWeight: 600 }}>{result.detail}</div>
              {result.ticket && <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: 'var(--cream-low)', marginTop: '8px' }}>{result.ticket.qr_code}</div>}
            </div>
            <button onClick={resetScan} style={{ width: '100%', marginTop: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(242,238,230,.06)', border: '1px solid var(--border-hi)', color: 'var(--cream)', fontFamily: 'DM Sans', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <RotateCcw size={14} /> Scan Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
