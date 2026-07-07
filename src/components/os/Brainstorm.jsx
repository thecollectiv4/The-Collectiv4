import { useState, useEffect, useRef } from 'react'
import { Loader2, Sparkles, Radar, Send, Save, Bookmark } from 'lucide-react'
import { supabase } from '@/api/supabase'
import { BONE, BONE_MID, BONE_LOW, SILVER, STAR, CARD, CARD_HI, HAIR, HAIR_HI, VOID, FONT_MONO, FONT_SANS, FONT_DISPLAY, chromeText } from '@/lib/cosmos'
import { Btn } from './ui'

function deriveTitle(text) {
  const first = (text || '').trim().split('\n')[0].replace(/^["“#*\-\s]+/, '')
  return first.length > 60 ? first.slice(0, 57).trimEnd() + '…' : (first || 'Untitled')
}

export default function Brainstorm({ onSaveContent, onSaveIntel }) {
  const [status, setStatus] = useState('checking')   // checking | online | coming_online | error
  const [mode, setMode] = useState('brainstorm')      // brainstorm | radar
  const [messages, setMessages] = useState([])        // {role, content}
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [saved, setSaved] = useState({})              // index -> true
  const scrollRef = useRef(null)

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  // probe availability (member + key present?) on mount
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/brainstorm', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ probe: true }) })
        if (!alive) return
        if (res.status === 503) return setStatus('coming_online')
        if (!res.ok) return setStatus('error')
        setStatus('online')
      } catch { if (alive) setStatus('error') }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, sending])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next); setInput(''); setSending(true)
    try {
      const res = await fetch('/api/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })), mode }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 503) { setStatus('coming_online'); return }
      if (!res.ok) { setMessages(m => [...m, { role: 'assistant', content: `⚠ ${data?.error || 'Something went wrong.'}`, error: true }]); return }
      setMessages(m => [...m, { role: 'assistant', content: data.reply || '(no reply)', mode }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: '⚠ Could not reach the model.', error: true }])
    } finally { setSending(false) }
  }

  if (status === 'checking') return <Center><Loader2 size={18} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} /></Center>
  if (status === 'coming_online') return <ComingOnline />
  if (status === 'error') return <Center><div style={{ textAlign: 'center', fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.1em' }}>BRAINSTORM UNAVAILABLE<br /><span style={{ color: 'rgba(91,89,82,.7)' }}>sign in as a member and retry</span></div></Center>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 320px)', minHeight: '360px' }}>
      {/* mode switch */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <ModeBtn active={mode === 'brainstorm'} onClick={() => setMode('brainstorm')} icon={Sparkles} label="Brainstorm" />
        <ModeBtn active={mode === 'radar'} onClick={() => setMode('radar')} icon={Radar} label="Radar" />
      </div>

      {/* transcript */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '2px' }}>
        {messages.length === 0 && (
          <div style={{ fontFamily: FONT_SANS, fontSize: '13px', color: BONE_LOW, lineHeight: 1.6, padding: '18px 2px' }}>
            {mode === 'radar'
              ? 'Radar scans the open web for what’s moving — venues, comparable events, cultural threads. Ask a question; save any finding to the intel list.'
              : 'Think out loud with the brand’s own voice. It knows this week’s tasks and the content pipeline. Draft a caption, shape a concept, pressure-test an idea — then save the good ones to the Content Engine.'}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
            <div style={{ fontFamily: m.role === 'user' ? FONT_SANS : FONT_SANS, fontSize: '13.5px', lineHeight: 1.55, color: m.error ? '#E5A0A0' : BONE, background: m.role === 'user' ? 'rgba(199,201,209,.10)' : CARD, border: `1px solid ${m.role === 'user' ? HAIR_HI : HAIR}`, borderRadius: '14px', padding: '11px 14px', whiteSpace: 'pre-wrap' }}>
              {m.content}
            </div>
            {m.role === 'assistant' && !m.error && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                {m.mode === 'radar'
                  ? <MiniBtn done={saved[i]} onClick={() => { onSaveIntel({ label: deriveTitle(m.content), finding: m.content }); setSaved(s => ({ ...s, [i]: true })) }} icon={Bookmark} label={saved[i] ? 'Saved to intel' : 'Save to intel'} />
                  : <MiniBtn done={saved[i]} onClick={() => { onSaveContent({ title: deriveTitle(m.content), caption: m.content, format: 'Scripted', status: 'idea' }); setSaved(s => ({ ...s, [i]: true })) }} icon={Save} label={saved[i] ? 'Saved to Engine' : 'Save to Engine'} />}
              </div>
            )}
          </div>
        ))}
        {sending && <div style={{ alignSelf: 'flex-start', display: 'inline-flex', gap: '6px', color: BONE_LOW, fontFamily: FONT_MONO, fontSize: '10px', padding: '4px 2px' }}><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> thinking…</div>}
      </div>

      {/* composer */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginTop: '12px', borderTop: `1px solid ${HAIR}`, paddingTop: '12px' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={mode === 'radar' ? 'Scan for…' : 'Think out loud…'} rows={1}
          style={{ flex: 1, background: VOID, border: `1px solid ${HAIR_HI}`, borderRadius: '12px', padding: '11px 13px', color: BONE, fontFamily: FONT_SANS, fontSize: '14px', outline: 'none', resize: 'none', maxHeight: '120px' }} />
        <button onClick={send} disabled={!input.trim() || sending} aria-label="Send" style={{ flexShrink: 0, width: '42px', height: '42px', borderRadius: '12px', border: 'none', background: input.trim() && !sending ? SILVER : CARD_HI, color: input.trim() && !sending ? VOID : BONE_LOW, cursor: input.trim() && !sending ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

function ModeBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: active ? 'rgba(199,201,209,.12)' : 'transparent', border: `1px solid ${active ? SILVER : HAIR_HI}`, color: active ? BONE : BONE_MID, borderRadius: '100px', padding: '7px 14px', fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
      <Icon size={12} /> {label}
    </button>
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
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: '30px', letterSpacing: '.04em', ...chromeText, marginBottom: '10px' }}>COMING ONLINE</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.1em', lineHeight: 1.7, maxWidth: '340px', margin: '0 auto' }}>
        The embedded intelligence is built and wired — it switches on the moment the Anthropic API key is set. Board, content and the vault mirror all work without it.
      </div>
    </div>
  )
}
