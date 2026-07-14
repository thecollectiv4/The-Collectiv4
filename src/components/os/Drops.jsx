import { useState, useRef, useEffect } from 'react'
import { Send, X, Loader2, Zap } from 'lucide-react'
import { VOID_2, BONE, BONE_MID, BONE_LOW, FAINT, SILVER, STAR, PANEL, HAIR, HAIR_HI, WARN, FONT_DISPLAY, FONT_MONO, FONT_SANS, relTime } from '@/lib/cosmos'

/* =========================================================================
   DROPS — the team as a product sensor (spec 11 jul, coffee shop session).
   A floating button on /os: any network member drops an idea or a bug from
   inside the platform → free text + where they were → it lands for the
   FOUNDERS to read (founders-only by RLS, migration 0019).

   Two presentational pieces, both fed by props (no supabase here — OS.jsx
   owns the session and the RPC, so the DEV harness can mount the instrument
   without a member session):
     · DropButton — the floating button + composer. Renders only when an
       onDrop handler is wired (the harness passes none → nothing floats).
     · DropsFeed  — the founders-only list, rendered by the instrument only
       on the server's owner verdict.

   ACTION INTEGRITY: "dropped" renders only after onDrop resolves ok:true.
   ========================================================================= */

const MAX = 2000

export function DropButton({ onDrop, desktop = false, context = {} }) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const taRef = useRef(null)

  useEffect(() => { if (open && taRef.current) taRef.current.focus() }, [open])
  // Esc closes the composer (never mid-send)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape' && !sending) { setOpen(false); setErr('') } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, sending])

  // don't mount the floating door in a context that can't record a drop (the
  // DEV layout harness passes no handler). All hooks run first — Rules of Hooks.
  if (!onDrop) return null

  const close = () => { setOpen(false); setErr('') }
  const reset = () => { setBody(''); setSent(false); setErr('') }

  const send = async () => {
    const text = body.trim()
    if (!text || sending) return
    setSending(true); setErr('')
    const res = await onDrop(text, { surface: 'os', ...context })
    setSending(false)
    if (res?.ok) {
      setSent(true)          // ACTION INTEGRITY — only the server ok flips this
      setBody('')
      setTimeout(() => { setOpen(false); setTimeout(reset, 250) }, 1400)
    } else {
      setErr(res?.error === 'not_network' ? 'network members only' : (res?.error || "couldn't send — try again"))
    }
  }

  const where = context?.tab ? `os · ${context.tab}` : 'os'

  return (
    <>
      {/* the floating door — clears the phone tab bar; steady, never loud */}
      <button
        onClick={() => setOpen(true)} aria-label="Drop an idea or a bug for the founders" title="Drop — idea or bug"
        style={{
          position: 'fixed', right: desktop ? '22px' : '16px',
          bottom: desktop ? '22px' : 'calc(86px + env(safe-area-inset-bottom, 0px))',
          zIndex: 9000, display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'rgba(199,201,209,.08)', border: `1px solid rgba(199,201,209,.32)`,
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '100px', padding: '11px 16px', color: BONE, cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(7,8,14,.5)', transition: 'background .2s, border-color .2s, transform .2s',
        }}
        onMouseOver={e => { e.currentTarget.style.background = 'rgba(199,201,209,.14)'; e.currentTarget.style.borderColor = SILVER; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseOut={e => { e.currentTarget.style.background = 'rgba(199,201,209,.08)'; e.currentTarget.style.borderColor = 'rgba(199,201,209,.32)'; e.currentTarget.style.transform = 'translateY(0)' }}>
        <Zap size={14} strokeWidth={1.8} style={{ color: STAR }} />
        <span style={{ fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.18em', textTransform: 'uppercase' }}>Drop</span>
      </button>

      {open && (
        <div onClick={() => !sending && close()} role="dialog" aria-label="Drop a note for the founders"
          style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(7,8,14,.78)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', padding: desktop ? '40px' : '0' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'relative', width: '100%', maxWidth: '460px', background: VOID_2, border: `1px solid ${HAIR_HI}`, borderRadius: desktop ? '16px' : '20px 20px 0 0', padding: '18px 18px calc(16px + env(safe-area-inset-bottom, 0px))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase' }}>⚡ Drop · to the founders</div>
              <button onClick={close} disabled={sending} aria-label="Close" style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: sending ? 'default' : 'pointer', padding: '2px', display: 'inline-flex' }}><X size={15} /></button>
            </div>

            {sent ? (
              <div style={{ padding: '18px 4px 22px', textAlign: 'center' }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: '30px', color: BONE, lineHeight: 1 }}>DROPPED</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.08em', marginTop: '10px', lineHeight: 1.6 }}>the founders see it. thank you for making this better.</div>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: FONT_SANS, fontSize: '13px', color: BONE_MID, lineHeight: 1.55, marginBottom: '12px' }}>
                  Something to improve? An idea? A bug? Say it straight — it goes to Pato &amp; Diego with where you were.
                </div>
                <textarea ref={taRef} value={body} maxLength={MAX}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send() }}
                  placeholder="what's on your mind…"
                  style={{ width: '100%', minHeight: '110px', resize: 'vertical', background: PANEL, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px', color: BONE, fontFamily: FONT_SANS, fontSize: '14px', lineHeight: 1.5, outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '9px', gap: '12px' }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.14em', textTransform: 'uppercase' }}>where · {where}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: body.length > MAX - 100 ? WARN : FAINT }}>{body.length}/{MAX}</span>
                </div>
                {err && <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: WARN, letterSpacing: '.04em', marginTop: '10px' }}>△ {err}</div>}
                <button onClick={send} disabled={sending || !body.trim()}
                  style={{ marginTop: '14px', width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '9px', background: body.trim() && !sending ? BONE : 'rgba(242,238,230,.12)', color: body.trim() && !sending ? '#0A0A0D' : BONE_LOW, border: 'none', borderRadius: '10px', padding: '13px', fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.18em', textTransform: 'uppercase', cursor: sending || !body.trim() ? 'default' : 'pointer' }}>
                  {sending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} strokeWidth={2} />}
                  {sending ? 'sending' : 'send the drop'}
                </button>
                <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.08em', marginTop: '9px', textAlign: 'center' }}>{desktop ? '⌘↵ to send · Esc to close' : 'private to the founders'}</div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/* DropsFeed — founders only (RLS returns rows only to owners; the instrument
   also gates the render on the owner verdict). Honest when quiet. */
export function DropsFeed({ drops = [], owners = {} }) {
  if (!drops.length) {
    return (
      <div style={{ marginTop: '22px', paddingTop: '14px', borderTop: `1px solid ${HAIR}`, maxWidth: '760px' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase', marginBottom: '11px' }}>⚡ Drops · from the team</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: '9.5px', color: FAINT, letterSpacing: '.08em', padding: '4px 0' }}>no drops yet — the team's first note lands here.</div>
      </div>
    )
  }
  return (
    <div style={{ marginTop: '22px', paddingTop: '14px', borderTop: `1px solid ${HAIR}`, maxWidth: '760px' }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase', marginBottom: '12px' }}>⚡ Drops · from the team</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {drops.map(d => {
          const who = owners[d.author_id]?.full_name || owners[d.author_id]?.username || 'Someone'
          const where = d.context?.tab ? `os · ${d.context.tab}` : (d.context?.surface || 'os')
          return (
            <div key={d.id} style={{ border: `1px solid ${HAIR_HI}`, background: PANEL, borderRadius: '12px', padding: '13px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '7px' }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: STAR, letterSpacing: '.04em', flexShrink: 0 }}>{who}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.12em', textTransform: 'uppercase' }}>{where}</span>
                <span style={{ marginLeft: 'auto', fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, flexShrink: 0 }}>{relTime(d.created_at)}</span>
              </div>
              <div style={{ fontFamily: FONT_SANS, fontSize: '13.5px', color: BONE_MID, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{d.body}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
