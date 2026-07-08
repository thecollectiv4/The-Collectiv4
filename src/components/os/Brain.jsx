import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Send, Save, Mic, MicOff, CalendarPlus, Check } from 'lucide-react'
import { supabase } from '@/api/supabase'
import { BONE, BONE_MID, BONE_LOW, FAINT, SILVER, STAR, PANEL, CARD_HI, HAIR, HAIR_HI, VOID, FONT_MONO, FONT_SANS, FONT_DISPLAY, chromeText } from '@/lib/cosmos'
import { useIsDesktop } from '@/lib/useIsDesktop'

/* =========================================================================
   THE BRAIN — the AI operator inside the OS. Voice-first composer (Web
   Speech API), agentic replies (it creates tasks, adds content, hands you a
   one-click calendar event), confirmation chips for every action taken.
   ========================================================================= */

const STARTERS = [
  "plan tomorrow's content",
  'set up a team call',
  "what's blocking Fall 001",
]

function deriveTitle(text) {
  const first = (text || '').trim().split('\n')[0].replace(/^["“#*\-\s]+/, '')
  return first.length > 60 ? first.slice(0, 57).trimEnd() + '…' : (first || 'Untitled')
}

export default function Brain({ onSaveContent, onActed, messages, setMessages }) {
  const desktop = useIsDesktop()
  const [status, setStatus] = useState('checking')   // checking | online | coming_online | error
  const [input, setInput] = useState('')
  const [interim, setInterim] = useState('')
  const [listening, setListening] = useState(false)
  const [sending, setSending] = useState(false)
  const [saved, setSaved] = useState({})
  const scrollRef = useRef(null)
  const recRef = useRef(null)
  const inputRef = useRef(null)

  const speechSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  // availability probe
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ probe: true }) })
        if (!alive) return
        if (res.status === 503) return setStatus('coming_online')
        if (!res.ok) return setStatus('error')
        setStatus('online')
      } catch { if (alive) setStatus('error') }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, sending, interim])
  useEffect(() => () => { try { recRef.current?.stop() } catch {} }, [])

  /* ---- voice: tap to talk, live transcript streams into the composer ---- */
  const stopListening = useCallback(() => {
    try { recRef.current?.stop() } catch {}
    recRef.current = null
    setListening(false)
    setInterim('')
  }, [])

  const toggleMic = useCallback(() => {
    if (listening) return stopListening()
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = navigator.language || 'en-US'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      if (recRef.current !== rec) return
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) {
          const t = r[0].transcript.trim()
          if (t) setInput((v) => (v ? v.replace(/\s+$/, '') + ' ' : '') + t)
        } else interimText += r[0].transcript
      }
      setInterim(interimText)
    }
    rec.onerror = () => { if (recRef.current === rec) stopListening() }
    rec.onend = () => { if (recRef.current !== rec) return; setListening(false); setInterim(''); recRef.current = null }
    recRef.current = rec
    setListening(true)
    try { rec.start() } catch { stopListening() }
  }, [listening, stopListening])

  /* ------------------------------- send ------------------------------- */
  async function send(textOverride) {
    const text = (textOverride ?? input).trim()
    if (!text || sending) return
    if (listening) stopListening()
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next); setInput(''); setSending(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 503) { setStatus('coming_online'); return }
      if (!res.ok) { setMessages((m) => [...m, { role: 'assistant', content: `⚠ ${data?.error || 'Something went wrong.'}`, error: true }]); return }
      setMessages((m) => [...m, { role: 'assistant', content: data.reply || '(no reply)', actions: data.actions || [] }])
      if ((data.actions || []).some((a) => a.type !== 'calendar')) onActed?.()
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: '⚠ Could not reach the Brain.', error: true }])
    } finally { setSending(false) }
  }

  /* ------------------------------ states ------------------------------ */
  if (status === 'checking') return <Center><Loader2 size={18} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} /></Center>
  if (status === 'coming_online') return <ComingOnline />
  if (status === 'error') return <Center><div style={{ textAlign: 'center', fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.1em' }}>THE BRAIN IS UNAVAILABLE<br /><span style={{ color: FAINT }}>sign in as a member and retry</span></div></Center>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: desktop ? 'calc(100vh - 230px)' : 'calc(100vh - 340px)', minHeight: '380px', maxWidth: desktop ? '840px' : 'none' }}>
      {/* transcript */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
        {messages.length === 0 && (
          <div className="os-reveal" style={{ padding: '26px 2px 10px' }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: desktop ? '44px' : '34px', lineHeight: .9, letterSpacing: '.02em', ...chromeText }}>TALK TO IT.</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: '13px', color: BONE_MID, lineHeight: 1.6, marginTop: '14px', maxWidth: '440px' }}>
              It knows the board, the pipeline, and the road to Fall 001. Ask it to think — or tell it to act: it creates tasks, drafts content, and hands you calendar events ready to click.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '20px' }}>
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} style={{ background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '8px 15px', color: BONE_MID, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.08em', cursor: 'pointer' }}>
                  ◇ {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="os-reveal-fast" style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: '13px', lineHeight: 1.55, color: m.error ? BONE_MID : BONE, background: m.role === 'user' ? 'rgba(199,201,209,.10)' : PANEL, border: `1px solid ${m.role === 'user' ? HAIR_HI : HAIR}`, borderRadius: '14px', padding: '11px 14px', whiteSpace: 'pre-wrap' }}>
              {m.content}
            </div>
            {m.role === 'assistant' && !m.error && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '7px' }}>
                {(m.actions || []).map((a, j) => <ActionChip key={j} a={a} />)}
                {!(m.actions || []).length && (
                  <MiniBtn done={saved[i]} icon={Save} label={saved[i] ? 'Saved to Engine' : 'Save to Engine'}
                    onClick={async () => { const ok = await onSaveContent({ title: deriveTitle(m.content), caption: m.content, format: 'Scripted', status: 'idea' }); if (ok !== false) setSaved((s) => ({ ...s, [i]: true })) }} />
                )}
              </div>
            )}
          </div>
        ))}
        {sending && <div style={{ alignSelf: 'flex-start', display: 'inline-flex', gap: '6px', color: BONE_LOW, fontFamily: FONT_MONO, fontSize: '10px', padding: '4px 2px' }}><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> thinking…</div>}
      </div>

      {/* composer — mic first */}
      <div style={{ marginTop: '12px', borderTop: `1px solid ${HAIR}`, paddingTop: '12px' }}>
        {listening && (
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.14em', textTransform: 'uppercase', paddingBottom: '8px' }}>
            ● listening{interim ? ` — ${interim}` : '…'}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          {speechSupported ? (
            <button onClick={toggleMic} aria-label={listening ? 'Stop listening' : 'Talk to the Brain'} title={listening ? 'Stop' : 'Tap to talk'}
              className={listening ? 'os-mic-live' : undefined}
              style={{ flexShrink: 0, width: '42px', height: '42px', borderRadius: '12px', border: `1px solid ${listening ? 'rgba(242,238,230,.55)' : HAIR_HI}`, background: listening ? 'rgba(242,238,230,.1)' : 'transparent', color: listening ? BONE : BONE_MID, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          ) : (
            <span title="Voice input needs Chrome (Web Speech API)" style={{ flexShrink: 0, width: '42px', height: '42px', borderRadius: '12px', border: `1px solid ${HAIR}`, color: FAINT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <MicOff size={15} />
            </span>
          )}
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={listening ? 'Speak — it types itself…' : 'Talk or type. It acts.'}
            rows={1}
            style={{ flex: 1, background: VOID, border: `1px solid ${HAIR_HI}`, borderRadius: '12px', padding: '11px 13px', color: BONE, fontFamily: FONT_SANS, fontSize: '14px', outline: 'none', resize: 'none', maxHeight: '120px' }} />
          <button onClick={() => send()} disabled={!input.trim() || sending} aria-label="Send"
            style={{ flexShrink: 0, width: '42px', height: '42px', borderRadius: '12px', border: 'none', background: input.trim() && !sending ? BONE : CARD_HI, color: input.trim() && !sending ? VOID : BONE_LOW, cursor: input.trim() && !sending ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={16} />
          </button>
        </div>
        {!speechSupported && (
          <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.1em', marginTop: '7px' }}>voice input needs Chrome — typing works everywhere</div>
        )}
      </div>
    </div>
  )
}

/* confirmation chips for actions the Brain took */
function ActionChip({ a }) {
  if (a.type === 'calendar') {
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(199,201,209,.1)', border: `1px solid ${SILVER}`, borderRadius: '100px', padding: '7px 14px', color: BONE, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none' }}>
        <CalendarPlus size={12} /> Add to Google Calendar · {a.date} {a.time}
      </a>
    )
  }
  const label = a.type === 'task_created' ? `task created → ${a.column}`
    : a.type === 'task_updated' ? `task updated${a.column ? ` → ${a.column}` : ''}`
    : a.type === 'content_added' ? `content added · ${a.format}`
    : a.type
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(199,201,209,.35)', background: 'rgba(199,201,209,.07)', borderRadius: '100px', padding: '6px 12px', color: STAR, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
      <Check size={11} /> {label}{a.title ? ` · “${a.title}”` : ''}
    </span>
  )
}

function MiniBtn({ onClick, icon: Icon, label, done }) {
  return (
    <button onClick={done ? undefined : onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', border: `1px solid ${done ? 'rgba(199,201,209,.3)' : HAIR}`, color: done ? STAR : BONE_LOW, borderRadius: '100px', padding: '5px 11px', fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase', cursor: done ? 'default' : 'pointer' }}>
      <Icon size={10} /> {label}
    </button>
  )
}

function Center({ children }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>{children}</div>
}

function ComingOnline() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: '32px', letterSpacing: '.04em', ...chromeText, marginBottom: '10px' }}>COMING ONLINE</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.1em', lineHeight: 1.7, maxWidth: '360px', margin: '0 auto' }}>
        The Brain is built and wired — voice, tools, calendar. It switches on the moment the Anthropic API key lands. Everything else in the OS already works.
      </div>
    </div>
  )
}
