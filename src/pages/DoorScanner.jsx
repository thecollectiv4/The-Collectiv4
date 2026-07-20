import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, Lock, RotateCcw, Keyboard, Camera } from 'lucide-react'
import { supabase } from '@/api/supabase'
import { useOSAccess } from '@/lib/osAccess'
import { VOID, VOID_2, BONE, BONE_MID, BONE_LOW, FAINT, SILVER, WARN, HAIR, HAIR_HI, FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText } from '@/lib/cosmos'

/* =========================================================================
   DOOR — the check-in instrument. Network-only (verified or owner), same
   server gate as /os: my_os_identity() client-side for the wall, and
   check_in_ticket() re-checks caller_is_network() server-side — the page is
   a viewport, never the authority. No PIN, no client secret, nothing in the
   bundle worth reading.

   Built for the actual door: one hand, dark room, loud. Mobile-first, giant
   result states, a full-width "scan next" you can hit with a thumb. Every
   state on this screen is the DB's answer — a scan shows CHECKING until the
   RPC returns; welcome / already-in / wrong-event / not-found render only
   from the server verdict (ACTION INTEGRITY: the check follows the row,
   never precedes it).
   ========================================================================= */

const RESULT_STYLES = {
  welcome:     { color: SILVER, border: 'rgba(var(--silver-rgb),.4)', bg: 'rgba(var(--silver-rgb),.08)', title: 'WELCOME IN' },
  already_in:  { color: WARN,   border: 'rgba(229,160,160,.4)', bg: 'rgba(229,160,160,.07)', title: 'ALREADY IN' },
  wrong_event: { color: WARN,   border: 'rgba(229,160,160,.4)', bg: 'rgba(229,160,160,.07)', title: 'WRONG EVENT' },
  not_found:   { color: WARN,   border: 'rgba(229,160,160,.4)', bg: 'rgba(229,160,160,.07)', title: 'NOT FOUND' },
  denied:      { color: WARN,   border: 'rgba(229,160,160,.4)', bg: 'rgba(229,160,160,.07)', title: 'NOT AUTHORIZED' },
  error:       { color: WARN,   border: 'rgba(229,160,160,.4)', bg: 'rgba(229,160,160,.07)', title: "COULDN'T CHECK" },
}

export default function DoorScanner() {
  const { state } = useOSAccess()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [eventsErr, setEventsErr] = useState('')
  const [stats, setStats] = useState(null)          // {confirmed, checked_in} — DB truth only
  const [mode, setMode] = useState('camera')        // camera | manual
  const [manualCode, setManualCode] = useState('')
  const [phase, setPhase] = useState('scan')        // scan | checking | result
  const [result, setResult] = useState(null)        // { status, name, detail }
  const [cameraErr, setCameraErr] = useState('')
  const [scanning, setScanning] = useState(false)
  const [sessionLog, setSessionLog] = useState([])  // this session, this device — a local note, not the source of truth
  const qrRef = useRef(null)
  const phaseRef = useRef('scan')
  phaseRef.current = phase
  // The camera callback is memoized once; it must always see the CURRENT event,
  // never the one captured when the closure was created (stale eventId would
  // silently scan un-scoped and kill wrong_event detection).
  const eventIdRef = useRef('')
  eventIdRef.current = eventId

  /* ---------- events for the picker (published only — no door for a draft) ---------- */
  useEffect(() => {
    if (state !== 'granted') return
    let alive = true
    ;(async () => {
      const { data, error } = await supabase.rpc('admin_list_events')
      if (!alive) return
      if (error || !data?.ok) { setEventsErr(error?.message || data?.error || 'could not load events'); return }
      const scannable = (data.events || []).filter(e => e.status === 'published')
      setEvents(scannable)
      const fromUrl = searchParams.get('event')
      const preferred = scannable.find(e => e.id === fromUrl) || scannable.find(e => !e.is_test) || scannable[0]
      if (preferred) setEventId(preferred.id)
    })()
    return () => { alive = false }
  }, [state])

  const refreshStats = useCallback(async (id) => {
    if (!id) { setStats(null); return }
    const { data, error } = await supabase.rpc('door_stats', { p_event: id })
    if (!error && data?.status === 'ok') setStats(data)
    else setStats(null)   // no invented counters — blank beats wrong
  }, [])
  useEffect(() => { refreshStats(eventId) }, [eventId, refreshStats])

  /* ---------- camera lifecycle ---------- */
  const stopCamera = useCallback(async () => {
    const sc = qrRef.current
    qrRef.current = null
    setScanning(false)
    if (sc) { try { await sc.stop() } catch {} try { sc.clear() } catch {} }
  }, [])

  const startCamera = useCallback(async () => {
    setCameraErr('')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      await stopCamera()
      const sc = new Html5Qrcode('door-qr-reader')
      qrRef.current = sc
      setScanning(true)
      await sc.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 }, aspectRatio: 1 },
        (text) => {
          if (phaseRef.current !== 'scan') return   // one code per phase — ignore double fires
          sc.stop().catch(() => {})
          setScanning(false)
          checkIn(text.trim().toUpperCase())
        },
        () => {}
      )
      // Cancellation guard: if cleanup ran while start() was in flight
      // (unmount, mode switch), qrRef no longer points at this instance —
      // stop the stream we just opened instead of leaking a live camera.
      if (qrRef.current !== sc) { try { await sc.stop() } catch {} try { sc.clear() } catch {} }
    } catch (err) {
      setScanning(false)
      setCameraErr('Camera unavailable — use manual entry below.')
    }
  }, [stopCamera])

  useEffect(() => {
    if (state === 'granted' && mode === 'camera' && phase === 'scan' && eventId) startCamera()
    return () => { stopCamera() }
  }, [state, mode, phase, eventId, startCamera, stopCamera])

  /* ---------- the check — server verdict only ---------- */
  const checkIn = async (qr) => {
    if (!qr) return
    // Never scan un-scoped: p_event=null would match the QR across ALL events
    // server-side (old-client compat path) — the exact cross-event hole this
    // page exists to close. No event selected → honest refusal, no RPC.
    const evId = eventIdRef.current
    if (!evId) {
      setResult({ status: 'error', detail: 'No event selected — wait for events to load or reload the page.' })
      setPhase('result')
      return
    }
    setPhase('checking')
    const { data, error } = await supabase.rpc('check_in_ticket', { p_qr: qr, p_event: evId })
    const r = data || {}
    let res
    if (error) {
      res = { status: 'error', detail: error.message || 'Network or server error — try again.' }
    } else if (r.status === 'denied') {
      res = { status: 'denied', detail: 'Door check-in is for verified network members only.' }
    } else if (r.status === 'not_found') {
      res = { status: 'not_found', detail: 'No confirmed ticket matches this code.' }
    } else if (r.status === 'wrong_event') {
      res = { status: 'wrong_event', name: r.name, detail: `This ticket is for ${r.event_title || 'another event'} — not this door.` }
    } else if (r.status === 'already_in') {
      res = { status: 'already_in', name: r.name, detail: 'This ticket was already scanned in.' }
    } else if (r.status === 'welcome') {
      res = { status: 'welcome', name: r.name }
      setSessionLog(prev => [{ name: r.name || 'Attendee', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev].slice(0, 40))
      refreshStats(evId)
    } else {
      res = { status: 'error', detail: 'Unexpected server response.' }
    }
    setResult(res)
    setPhase('result')
  }

  const scanNext = () => { setResult(null); setManualCode(''); setPhase('scan') }

  /* ------------------------------- gates ------------------------------- */
  if (state === 'loading') return (
    <Wall><Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} /></Wall>
  )
  if (state === 'denied') return (
    <Wall>
      <div style={{ textAlign: 'center', maxWidth: '300px' }}>
        <Lock size={24} style={{ color: BONE_LOW }} />
        <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: '14px' }}>Our network only</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.04em', marginTop: '10px', lineHeight: 1.6 }}>The door scanner is for verified members of The Collectiv4.</div>
        <button onClick={() => navigate('/')} style={{ marginTop: '18px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '9px 18px', color: BONE_MID, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.1em', cursor: 'pointer' }}>← Event</button>
      </div>
    </Wall>
  )

  const currentEvent = events.find(e => e.id === eventId)
  const rs = result ? (RESULT_STYLES[result.status] || RESULT_STYLES.error) : null

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(120% 70% at 50% -10%, rgba(var(--ink-rgb),.05) 0%, rgba(var(--ink-rgb),0) 55%), ${VOID}` }}>
      <div style={{ padding: '20px 18px 130px', maxWidth: '520px', margin: '0 auto' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.28em', textTransform: 'uppercase' }}>Our network · check-in</div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '40px', letterSpacing: '.02em', lineHeight: .9, margin: '6px 0 0', ...chromeText }}>DOOR</h1>
          </div>
          {stats && (
            <div style={{ textAlign: 'right', paddingBottom: '4px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: '17px', color: BONE }}>{stats.checked_in}<span style={{ color: FAINT }}> / {stats.confirmed}</span></div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase' }}>in / confirmed</div>
            </div>
          )}
        </div>

        {/* event picker — the door works ONE event; every scan is scoped to it */}
        <div style={{ marginTop: '16px' }}>
          {eventsErr ? (
            <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: WARN, letterSpacing: '.04em' }}>{eventsErr}</div>
          ) : events.length === 0 ? (
            <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.06em' }}>No published events to scan for.</div>
          ) : events.length === 1 ? (
            <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              ◇ {currentEvent?.title}{currentEvent?.edition ? ` · ${currentEvent.edition}` : ''}{currentEvent?.is_test ? ' · TEST' : ''}
            </div>
          ) : (
            <select className="os-select" value={eventId} onChange={e => setEventId(e.target.value)}
              style={{ width: '100%', background: VOID_2, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 30px 12px 13px', color: BONE, fontFamily: FONT_MONO, fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
              {events.map(e => <option key={e.id} value={e.id}>{e.title}{e.edition ? ` · ${e.edition}` : ''}{e.is_test ? ' · TEST' : ''}</option>)}
            </select>
          )}
        </div>

        {/* scan surface */}
        <div style={{ marginTop: '18px' }}>
          {phase === 'checking' && (
            <div style={{ padding: '60px 20px', borderRadius: '16px', border: `1px solid ${HAIR_HI}`, background: VOID_2, textAlign: 'center' }}>
              <Loader2 size={26} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
              <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID, letterSpacing: '.2em', textTransform: 'uppercase', marginTop: '14px' }}>Checking…</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: FAINT, letterSpacing: '.06em', marginTop: '8px' }}>Asking the database — nothing is confirmed yet.</div>
            </div>
          )}

          {phase === 'result' && result && (
            <div>
              <div style={{ padding: '34px 20px', borderRadius: '16px', border: `1px solid ${rs.border}`, background: rs.bg, textAlign: 'center' }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: '42px', lineHeight: .95, color: rs.color, letterSpacing: '.02em' }}>{rs.title}</div>
                {result.name && <div style={{ fontFamily: FONT_SANS, fontSize: '19px', fontWeight: 600, color: BONE, marginTop: '10px' }}>{result.name}</div>}
                {result.detail && <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID, letterSpacing: '.03em', marginTop: '10px', lineHeight: 1.5 }}>{result.detail}</div>}
              </div>
              <button onClick={scanNext}
                style={{ width: '100%', marginTop: '14px', padding: '20px', borderRadius: '14px', background: BONE, border: 'none', color: VOID, fontFamily: FONT_MONO, fontSize: '13px', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <RotateCcw size={15} /> Scan next
              </button>
            </div>
          )}

          {phase === 'scan' && mode === 'camera' && (
            <div>
              <div style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: '#000' }}>
                <div id="door-qr-reader" style={{ width: '100%' }} />
                {!scanning && !cameraErr && (
                  <div style={{ padding: '56px 20px', textAlign: 'center', fontFamily: FONT_MONO, fontSize: '11px', color: BONE_LOW, letterSpacing: '.08em' }}>Starting camera…</div>
                )}
                {cameraErr && (
                  <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: FONT_MONO, fontSize: '11px', color: WARN, letterSpacing: '.04em', lineHeight: 1.6 }}>{cameraErr}</div>
                )}
              </div>
              <button onClick={() => { stopCamera(); setMode('manual') }}
                style={{ width: '100%', marginTop: '12px', padding: '14px', borderRadius: '12px', background: 'transparent', border: `1px solid ${HAIR_HI}`, color: BONE_MID, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Keyboard size={13} /> Type the code instead
              </button>
            </div>
          )}

          {phase === 'scan' && mode === 'manual' && (
            <div>
              {!eventId && (
                <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: WARN, letterSpacing: '.06em', marginBottom: '10px', textAlign: 'center' }}>
                  No event selected — check-in is disabled until events load.
                </div>
              )}
              <input value={manualCode} onChange={e => setManualCode(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter' && manualCode.trim() && eventId) checkIn(manualCode.trim()) }}
                placeholder="TICKET CODE" autoFocus autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                style={{ width: '100%', background: VOID_2, border: `1px solid ${HAIR_HI}`, borderRadius: '14px', padding: '20px 16px', color: BONE, fontFamily: FONT_MONO, fontSize: '18px', letterSpacing: '.08em', textAlign: 'center', outline: 'none' }} />
              <button onClick={() => manualCode.trim() && eventId && checkIn(manualCode.trim())} disabled={!manualCode.trim() || !eventId}
                style={{ width: '100%', marginTop: '12px', padding: '20px', borderRadius: '14px', background: manualCode.trim() && eventId ? BONE : 'rgba(var(--ink-rgb),.08)', border: 'none', color: manualCode.trim() && eventId ? VOID : BONE_LOW, fontFamily: FONT_MONO, fontSize: '13px', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', cursor: manualCode.trim() && eventId ? 'pointer' : 'default' }}>
                Check in
              </button>
              <button onClick={() => setMode('camera')}
                style={{ width: '100%', marginTop: '10px', padding: '13px', borderRadius: '12px', background: 'transparent', border: `1px solid ${HAIR_HI}`, color: BONE_MID, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Camera size={13} /> Back to camera
              </button>
            </div>
          )}
        </div>

        {/* session log — a local note for the person at the door, not a data surface */}
        {sessionLog.length > 0 && (
          <div style={{ marginTop: '26px' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: '10px' }}>△ this session · this device ({sessionLog.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sessionLog.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', padding: '8px 0', borderBottom: i === sessionLog.length - 1 ? 'none' : `1px solid ${HAIR}` }}>
                  <span style={{ fontFamily: FONT_SANS, fontSize: '13px', color: BONE, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: FAINT, flexShrink: 0 }}>{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Wall({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: VOID, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      {children}
    </div>
  )
}
