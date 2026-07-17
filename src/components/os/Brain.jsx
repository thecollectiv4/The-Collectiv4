import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Send, Save, Mic, MicOff, CalendarPlus, Check } from 'lucide-react'
import { supabase } from '@/api/supabase'
import { BONE, BONE_MID, BONE_LOW, FAINT, SILVER, STAR, PANEL, CARD_HI, HAIR, HAIR_HI, VOID, FONT_MONO, FONT_SANS, FONT_DISPLAY, chromeText } from '@/lib/cosmos'
import { useIsDesktop } from '@/lib/useIsDesktop'

/* =========================================================================
   THE BRAIN — the AI operator inside the OS. Voice-first composer (Web
   Speech API), agentic replies (it creates tasks, adds content, hands you a
   one-click calendar event), confirmation chips for every action taken.

   RENDER RULE — no action exists without its chip. When the server flags
   unexecuted_claims (reply text claims an action but ZERO tools ran) and no
   actions[] arrived, the message gets an honest mono footnote: "△ said, not
   done". The text is treated as intention, never as fact.
   ========================================================================= */

/* YOUR TODAY (Ley 16) — the Brain's landing is the board's real state, and
   every suggestion is born from a real item. No generic chips: when the
   board is empty the one honest move is offered instead. */
function contextStarters(ctx) {
  const s = []
  if (ctx?.week?.length) s.push(`what's the move on "${ctx.week[0]}"?`)
  if (ctx?.motion?.length) s.push(`unblock "${ctx.motion[0]}" — what's in the way?`)
  if (ctx?.toMake?.length) s.push(`plan the shoot for "${ctx.toMake[0]}"`)
  if (ctx?.nextEvent) s.push(`what's left before ${ctx.nextEvent.title}?`)
  if (!s.length) s.push('set up this week — what matters most?')
  return s.slice(0, 3)
}

function deriveTitle(text) {
  const first = (text || '').trim().split('\n')[0].replace(/^["“#*\-\s]+/, '')
  return first.length > 60 ? first.slice(0, 57).trimEnd() + '…' : (first || 'Untitled')
}

/* embedded — dock sizing: fill the host panel's height, no maxWidth, smaller
   empty-state type. Same state, same session — the dock and the tab are one
   continuous conversation (messages live lifted in OS.jsx).
   entrance — YOUR TODAY's staged reveal, on the brain tab's first visit only.
   The dock opens on a keystroke (B), a hundred times a day: it never replays. */
export default function Brain({ onSaveContent, onActed, messages, setMessages, embedded, context, entrance = false }) {
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
  // the transcript is HISTORY, not news: only a message that arrived after this
  // mount animates. Initialized to the CURRENT length — the messages live in
  // OS.jsx and outlive us, so a remount (B, tab switch) re-reads a transcript
  // that is already old and animates none of it.
  const prevLen = useRef(messages.length)
  useEffect(() => { prevLen.current = messages.length }, [messages.length])

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
  // baseMessages lets a caller send off an already-updated transcript (e.g.
  // marking a confirm_delete chip resolved) without losing that update to
  // this closure's stale `messages`.
  async function send(textOverride, baseMessages) {
    const text = (textOverride ?? input).trim()
    if (!text || sending) return
    if (listening) stopListening()
    const next = [...(baseMessages ?? messages), { role: 'user', content: text }]
    setMessages(next); setInput(''); setSending(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 503) { setStatus('coming_online'); return }
      if (!res.ok) { setMessages((m) => [...m, { role: 'assistant', content: `✕ ${data?.error || 'Something went wrong.'}`, error: true }]); return }
      setMessages((m) => [...m, { role: 'assistant', content: data.reply || '(no reply)', actions: data.actions || [], unexecuted_claims: !!data.unexecuted_claims }])
      // refresh the board/content for anything that changed data — calendar is
      // a handoff and confirm_delete is a pending op (nothing changed yet).
      if ((data.actions || []).some((a) => a.type !== 'calendar' && a.type !== 'confirm_delete')) onActed?.()
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: '✕ Could not reach the Brain.', error: true }])
    } finally { setSending(false) }
  }

  /* confirm_delete chips — the human sign-off for the model's destructive ops.
     The chosen answer is stamped onto the action (inert chip) and the reply is
     sent as a REAL user message: the confirm marker is code-checked server-side. */
  function respondConfirm(msgIdx, actIdx, a, choice) {
    const marked = messages.map((m, mi) => mi !== msgIdx ? m
      : { ...m, actions: (m.actions || []).map((x, ai) => ai === actIdx ? { ...x, resolved: choice } : x) })
    send(choice === 'confirm' ? `[confirm delete ${a.kind} ${a.id}]` : "Cancel that — don't delete it.", marked)
  }

  /* ------------------------------ states ------------------------------ */
  if (status === 'checking') return <Center><Loader2 size={18} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} /></Center>
  if (status === 'coming_online') return <ComingOnline />
  if (status === 'error') return <Center><div style={{ textAlign: 'center', fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.1em' }}>THE BRAIN IS UNAVAILABLE<br /><span style={{ color: FAINT }}>sign in as a member and retry</span></div></Center>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: embedded ? '100%' : desktop ? 'calc(100vh - 230px)' : 'calc(100vh - 340px)', minHeight: embedded ? 0 : '380px', maxWidth: embedded ? 'none' : desktop ? '840px' : 'none' }}>
      {/* transcript */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
        {messages.length === 0 && (
          /* YOUR TODAY — the Brain lands on the real state of the room (Ley 16):
             days to Fall 001, what's actually on the board, the next real date.
             The screen's one chrome moment is the days number. */
          <div className={entrance ? 'os-reveal' : ''} style={{ padding: embedded ? '14px 2px 8px' : '26px 2px 10px' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.28em', textTransform: 'uppercase' }}>
              ◇ your today · {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: embedded ? '44px' : desktop ? '64px' : '50px', lineHeight: .85, letterSpacing: '.01em', ...chromeText }}>
                {context?.days >= 0 ? String(context.days).padStart(2, '0') : '—'}
              </span>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: embedded ? '20px' : desktop ? '26px' : '22px', lineHeight: 1, color: BONE }}>DAYS TO FALL 001</span>
            </div>

            <div style={{ marginTop: '16px', maxWidth: '520px', display: 'flex', flexDirection: 'column' }}>
              <TodayRow label="this week" items={context?.week} empty="nothing pulled in yet — the week is open" />
              <TodayRow label="in motion" items={context?.motion} empty="nothing moving yet" />
              <TodayRow label="to make" items={context?.toMake} empty="the pipeline is clear" />
              <TodayRow label="next event" items={context?.nextEvent ? [`${context.nextEvent.title} · ${context.nextEvent.date}`] : null} empty="no date on the books yet" />
            </div>

            <div style={{ fontFamily: FONT_SANS, fontSize: '12.5px', color: BONE_MID, lineHeight: 1.6, marginTop: '16px', maxWidth: '440px' }}>
              This is the room, live. Ask it to think — or tell it to act: it creates tasks, drafts content, and hands you calendar events ready to click.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
              {contextStarters(context).map((s) => (
                <button key={s} onClick={() => send(s)} style={{ background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '8px 15px', color: BONE_MID, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.08em', cursor: 'pointer', textAlign: 'left' }}>
                  ◇ {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={i >= prevLen.current ? 'msg-in' : ''} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: '13px', lineHeight: 1.55, color: m.error ? BONE_MID : BONE, background: m.role === 'user' ? 'rgba(199,201,209,.10)' : PANEL, border: `1px solid ${m.role === 'user' ? HAIR_HI : HAIR}`, borderRadius: '14px', padding: '11px 14px', whiteSpace: 'pre-wrap' }}>
              {m.content}
            </div>
            {/* integrity footnote — the server saw an action claim with zero tool
                calls. No chip = no action: the words above are intention, not fact. */}
            {m.role === 'assistant' && !m.error && m.unexecuted_claims && !(m.actions || []).length && (
              <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.08em', marginTop: '5px', paddingLeft: '2px' }}>
                △ said, not done — no action was executed this turn
              </div>
            )}
            {m.role === 'assistant' && !m.error && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '7px' }}>
                {(m.actions || []).map((a, j) => <ActionChip key={j} a={a} busy={sending} onRespond={(choice) => respondConfirm(i, j, a, choice)} />)}
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
function ActionChip({ a, busy, onRespond }) {
  if (a.type === 'calendar') {
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(199,201,209,.1)', border: `1px solid ${SILVER}`, borderRadius: '100px', padding: '7px 14px', color: BONE, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none' }}>
        <CalendarPlus size={12} /> Add to Google Calendar · {a.date} {a.time}
      </a>
    )
  }
  /* pending destructive op — the model asked; only a human message may confirm.
     Both buttons send REAL user messages (the confirm marker is code-checked
     server-side); once either is clicked the chip goes inert and states it. */
  if (a.type === 'confirm_delete') {
    if (a.resolved) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '6px 12px', color: BONE_LOW, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
          {a.resolved === 'confirm' ? '✕' : '○'} {a.resolved === 'confirm' ? 'delete confirmed' : 'kept'}{a.title ? ` · “${a.title}”` : ''}
        </span>
      )
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', border: '1px solid rgba(199,201,209,.35)', background: 'rgba(199,201,209,.05)', borderRadius: '100px', padding: '5px 6px 5px 12px', color: BONE_MID, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
        △ delete {a.kind}{a.title ? ` “${a.title}”` : ''}?
        <button onClick={() => !busy && onRespond?.('confirm')} disabled={busy}
          style={{ background: BONE, color: VOID, border: `1px solid ${BONE}`, borderRadius: '100px', padding: '5px 11px', fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: busy ? 'default' : 'pointer', opacity: busy ? .5 : 1 }}>
          Confirm delete
        </button>
        <button onClick={() => !busy && onRespond?.('cancel')} disabled={busy}
          style={{ background: 'transparent', color: BONE_MID, border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '5px 11px', fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: busy ? 'default' : 'pointer', opacity: busy ? .5 : 1 }}>
          Cancel
        </button>
      </span>
    )
  }
  const label = a.type === 'task_created' ? `task created → ${a.column}`
    : a.type === 'task_updated' ? `task updated${a.column ? ` → ${a.column}` : ''}`
    : a.type === 'content_added' ? `content added · ${a.format}`
    : a.type === 'content_updated' ? 'content updated'
    : a.type === 'task_deleted' ? 'task deleted'
    : a.type === 'content_deleted' ? 'content deleted'
    : a.type
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(199,201,209,.35)', background: 'rgba(199,201,209,.07)', borderRadius: '100px', padding: '6px 12px', color: STAR, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
      <Check size={11} /> {label}{a.title ? ` · “${a.title}”` : ''}
    </span>
  )
}

/* One line of YOUR TODAY — real items or an honest empty, never filler. */
function TodayRow({ label, items, empty }) {
  const has = Array.isArray(items) && items.length > 0
  const shown = has ? items.slice(0, 3) : []
  const more = has ? items.length - shown.length : 0
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', padding: '6px 0', borderBottom: `1px solid ${HAIR}` }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', flexShrink: 0, width: '76px' }}>{label}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: has ? BONE_MID : FAINT, letterSpacing: '.02em', lineHeight: 1.55, minWidth: 0 }}>
        {has ? <>{shown.join(' · ')}{more > 0 && <span style={{ color: FAINT }}> +{more}</span>}</> : empty}
      </span>
    </div>
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
